import type { SupabaseClient } from "@supabase/supabase-js";

import { canClientReschedule, overlaps, timeToMinutes } from "./salon";
import { createAdminClient } from "./supabase-admin.server";

function admin(): SupabaseClient {
  return createAdminClient();
}

type Loaded = {
  id: string;
  client_id: string;
  day: string;
  start_time: string;
  status: string;
  serviceName: string;
  duration: number;
};

async function loadAppointment(db: SupabaseClient, appointmentId: string): Promise<Loaded> {
  const { data } = await db
    .from("appointments")
    .select("id, client_id, day, start_time, status, services(name, duration_minutes)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!data) throw new Error("Agendamento não encontrado.");
  const joined = (data as { services: unknown }).services;
  const service = (Array.isArray(joined) ? joined[0] : joined) as
    | { name?: string; duration_minutes?: number }
    | null;
  return {
    id: String(data.id),
    client_id: String(data.client_id),
    day: String(data.day),
    start_time: String(data.start_time),
    status: String(data.status),
    serviceName: String(service?.name ?? "Procedimento"),
    duration: Number(service?.duration_minutes ?? 60),
  };
}

/** Garante que o novo horário não conflita com outro atendimento ativo. */
async function assertFreeSlot(
  db: SupabaseClient,
  appointmentId: string,
  day: string,
  startTime: string,
  duration: number,
) {
  const { data } = await db.rpc("busy_times_except", { p_day: day, p_exclude: appointmentId });
  const start = timeToMinutes(startTime);
  const end = start + duration;
  for (const row of (data ?? []) as { start_time: string; duration_minutes: number }[]) {
    const otherStart = timeToMinutes(String(row.start_time));
    const otherEnd = otherStart + Number(row.duration_minutes ?? 60);
    if (overlaps(start, end, otherStart, otherEnd)) {
      throw new Error("Este horário já está ocupado por outro atendimento.");
    }
  }
}

/**
 * Alocação livre da administradora: horários fora do cronograma padrão passam a
 * valer como "Atendimento Especial" naquela data específica.
 */
async function ensureSpecialDay(db: SupabaseClient, day: string, startTime: string) {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = new Date(y!, (m ?? 1) - 1, d ?? 1).getDay();
  const { data: blocked } = await db.from("blocked_dates").select("id").eq("day", day).maybeSingle();
  const { data: slot } = await db
    .from("schedule_slots")
    .select("id")
    .eq("weekday", weekday)
    .eq("active", true)
    .eq("start_time", `${startTime}:00`)
    .maybeSingle();
  const { data: special } = await db
    .from("special_days")
    .select("id, times, reason")
    .eq("day", day)
    .maybeSingle();
  if (slot && !blocked && !special) return false;
  const times = new Set<string>(
    ((special?.times as string[] | null) ?? []).map((t) => String(t).slice(0, 5)),
  );
  times.add(startTime);
  const payload = {
    day,
    times: Array.from(times)
      .sort()
      .map((t) => `${t}:00`),
    reason: special?.reason ?? "Atendimento especial",
    active: true,
  };
  if (special) await db.from("special_days").update(payload).eq("id", special.id);
  else await db.from("special_days").insert(payload);
  return true;
}

/** Move o atendimento para o novo dia/horário, já confirmado, e atualiza a agenda. */
async function applyMove(db: SupabaseClient, appt: Loaded, day: string, startTime: string) {
  await assertFreeSlot(db, appt.id, day, startTime, appt.duration);
  const special = await ensureSpecialDay(db, day, startTime);
  const { error } = await db
    .from("appointments")
    .update({
      day,
      start_time: `${startTime}:00`,
      status: "confirmado",
      cancelled_at: null,
      cancelled_by: null,
      reminder_sent_at: null,
    })
    .eq("id", appt.id);
  if (error) throw new Error("Não foi possível salvar o novo horário.");

  let calendar: "ok" | "falhou" = "ok";
  try {
    const { syncAppointmentToCalendar } = await import("./calendar-helpers.server");
    await syncAppointmentToCalendar(appt.id);
  } catch (calendarError) {
    console.error("Falha ao atualizar a Google Agenda no reagendamento", calendarError);
    calendar = "falhou";
  }

  const { data: client } = await db
    .from("profiles")
    .select("full_name, phone")
    .eq("id", appt.client_id)
    .maybeSingle();

  return {
    calendar,
    special,
    oldDay: appt.day,
    oldStart: appt.start_time,
    day,
    startTime,
    serviceName: appt.serviceName,
    durationMinutes: appt.duration,
    client: {
      name: String(client?.full_name ?? "Cliente"),
      phone: String(client?.phone ?? ""),
    },
  };
}

/** Cliente pede a alteração de data/horário (respeitando as 72h de antecedência). */
export async function requestReschedule(
  userId: string,
  appointmentId: string,
  day: string,
  startTime: string,
  reason: string,
) {
  const db = admin();
  const appt = await loadAppointment(db, appointmentId);
  if (appt.client_id !== userId) throw new Error("Este agendamento não é seu.");
  if (appt.status !== "confirmado") {
    throw new Error("Só é possível pedir alteração de atendimentos confirmados.");
  }
  if (!canClientReschedule(appt.day, appt.start_time)) {
    throw new Error(
      "Alterações pelo app são permitidas apenas com até 72h de antecedência. Entre em contato direto pelo WhatsApp.",
    );
  }
  const { data: pending } = await db
    .from("reschedule_requests")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("status", "pendente")
    .maybeSingle();
  if (pending) throw new Error("Você já tem um pedido de alteração aguardando aprovação.");

  await assertFreeSlot(db, appt.id, day, startTime, appt.duration);

  const { error } = await db.from("reschedule_requests").insert({
    appointment_id: appointmentId,
    client_id: userId,
    old_day: appt.day,
    old_start_time: appt.start_time,
    requested_day: day,
    requested_start_time: `${startTime}:00`,
    reason,
  });
  if (error) throw new Error("Não foi possível registrar o pedido.");

  const { data: client } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  return {
    ok: true as const,
    oldDay: appt.day,
    oldStart: appt.start_time,
    day,
    startTime,
    serviceName: appt.serviceName,
    reason,
    clientName: String(client?.full_name ?? "Cliente"),
  };
}

/** Administradora aprova (aplicando o novo horário) ou recusa o pedido. */
export async function decideReschedule(requestId: string, approve: boolean) {
  const db = admin();
  const { data: request } = await db
    .from("reschedule_requests")
    .select("id, appointment_id, requested_day, requested_start_time, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) throw new Error("Pedido não encontrado.");
  if (String(request.status) !== "pendente") throw new Error("Esse pedido já foi decidido.");

  let moved: Awaited<ReturnType<typeof applyMove>> | null = null;
  if (approve) {
    const appt = await loadAppointment(db, String(request.appointment_id));
    moved = await applyMove(
      db,
      appt,
      String(request.requested_day),
      String(request.requested_start_time).slice(0, 5),
    );
  }

  await db
    .from("reschedule_requests")
    .update({
      status: approve ? "aprovado" : "recusado",
      decided_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  return { ok: true as const, approved: approve, moved };
}

/** Reagendamento direto pela administradora, sem restrição de data ou horário. */
export async function adminReschedule(appointmentId: string, day: string, startTime: string) {
  const db = admin();
  const appt = await loadAppointment(db, appointmentId);
  const moved = await applyMove(db, appt, day, startTime);
  await db
    .from("reschedule_requests")
    .update({ status: "aprovado", decided_at: new Date().toISOString() })
    .eq("appointment_id", appointmentId)
    .eq("status", "pendente");
  return moved;
}