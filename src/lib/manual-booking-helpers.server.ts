import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { overlaps, timeToMinutes } from "./salon";

function admin(): SupabaseClient {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ManualAppointmentData = {
  clientId?: string | undefined;
  clientName?: string | undefined;
  clientPhone?: string | undefined;
  serviceId: string;
  day: string;
  startTime: string;
  paymentMethod?: "pix" | "credito" | "debito" | "dinheiro" | undefined;
  notes?: string | undefined;
};

/** Impede dois atendimentos no mesmo intervalo (validação antichoque). */
async function assertFreeSlot(
  db: SupabaseClient,
  day: string,
  startTime: string,
  duration: number,
) {
  const { data } = await db
    .from("appointments")
    .select("start_time, services(duration_minutes)")
    .eq("day", day)
    .in("status", ["pendente", "confirmado", "concluido"]);

  const startA = timeToMinutes(startTime);
  const endA = startA + duration;
  for (const row of data ?? []) {
    const joined = (row as { services: unknown }).services;
    const service = Array.isArray(joined) ? joined[0] : joined;
    const otherStart = timeToMinutes(String(row.start_time));
    const otherEnd = otherStart + Number((service as { duration_minutes?: number })?.duration_minutes ?? 60);
    if (overlaps(startA, endA, otherStart, otherEnd)) {
      throw new Error("Este horário já está ocupado por outro atendimento.");
    }
  }
}

/**
 * Alocação livre: quando a data/horário está fora do cronograma padrão
 * (domingo, dia bloqueado ou fora do expediente), registramos a data como
 * "Atendimento Especial" com aquele horário, sem mexer na regra semanal.
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

/** Cria um atendimento já confirmado a partir do painel administrativo. */
export async function createManualAppointment(input: ManualAppointmentData) {
  const db = admin();

  const { data: service } = await db
    .from("services")
    .select("id, name, price_cents, duration_minutes")
    .eq("id", input.serviceId)
    .maybeSingle();
  if (!service) throw new Error("Procedimento não encontrado.");

  await assertFreeSlot(db, input.day, input.startTime, Number(service.duration_minutes ?? 60));

  let clientId = input.clientId ?? null;
  let createdClient = false;
  let clientLoginId: string | null = null;
  if (!clientId) {
    const { ensureManualClient } = await import("./auth-helpers.server");
    const result = await ensureManualClient(String(input.clientName), input.clientPhone ?? "");
    clientId = result.clientId;
    createdClient = result.created;
    clientLoginId = result.loginId;
  }

  const special = await ensureSpecialDay(db, input.day, input.startTime);

  const { data: created, error } = await db
    .from("appointments")
    .insert({
      client_id: clientId,
      service_id: service.id,
      day: input.day,
      start_time: `${input.startTime}:00`,
      status: "confirmado",
      price_cents: Number(service.price_cents ?? 0),
      benefit_type: "nenhum",
      discount_percent: 0,
      ...(input.paymentMethod ? { payment_method: input.paymentMethod } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    })
    .select("id")
    .maybeSingle();
  if (error || !created) throw new Error("Não foi possível salvar o agendamento.");

  let calendar: "ok" | "falhou" = "ok";
  try {
    const { syncAppointmentToCalendar } = await import("./calendar-helpers.server");
    await syncAppointmentToCalendar(String(created.id));
  } catch (calendarError) {
    console.error("Falha ao publicar agendamento manual na Google Agenda", calendarError);
    calendar = "falhou";
  }

  const { data: profile } = await db
    .from("profiles")
    .select("full_name, phone, login_id")
    .eq("id", clientId)
    .maybeSingle();

  return {
    appointmentId: String(created.id),
    calendar,
    special,
    createdClient,
    client: {
      name: String(profile?.full_name ?? input.clientName ?? "Cliente"),
      phone: String(profile?.phone ?? input.clientPhone ?? ""),
      loginId: String(profile?.login_id ?? clientLoginId ?? ""),
    },
    service: {
      name: String(service.name),
      durationMinutes: Number(service.duration_minutes ?? 60),
    },
  };
}
