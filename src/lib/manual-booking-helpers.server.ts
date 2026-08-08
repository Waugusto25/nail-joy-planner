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
  const { data: blocked } = await db.from("blocked_dates").select("id").eq("day", day).maybeSingle();
  if (blocked) throw new Error("Este dia está bloqueado na agenda.");

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
  if (!clientId) {
    const { ensureManualClient } = await import("./auth-helpers.server");
    clientId = await ensureManualClient(String(input.clientName), input.clientPhone ?? "");
  }

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

  return { appointmentId: String(created.id), calendar };
}
