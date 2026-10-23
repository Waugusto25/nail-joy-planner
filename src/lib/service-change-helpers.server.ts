import { findDelayConflicts, newPriceCents, type BusyRow } from "./service-change";
import { createAdminClient } from "./supabase-admin.server";

/**
 * Troca o procedimento de um agendamento: atualiza valor e duração (a duração
 * vem do serviço, então a agenda libera ou ocupa tempo automaticamente).
 * Se invadir outro atendimento, só grava com o aceite explícito da administradora.
 */
export async function changeAppointmentService(
  appointmentId: string,
  serviceId: string,
  acceptDelay: boolean,
) {
  const db = createAdminClient();
  const { data: appt } = await db
    .from("appointments")
    .select("id, day, start_time, status, discount_percent")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) throw new Error("Agendamento não encontrado.");
  if (appt.status === "cancelado") throw new Error("Agendamento cancelado não pode ser editado.");

  const { data: service } = await db
    .from("services")
    .select("id, name, price_cents, duration_minutes")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service) throw new Error("Procedimento não encontrado.");
  const duration = Number(service.duration_minutes ?? 60);

  const { data: others } = await db
    .from("appointments")
    .select("start_time, client_id")
    .eq("day", appt.day)
    .neq("id", appointmentId)
    .in("status", ["pendente", "confirmado"]);
  const ids = Array.from(new Set((others ?? []).map((o) => String(o.client_id))));
  const { data: profs } = ids.length
    ? await db.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map((profs ?? []).map((p) => [String(p.id), String(p.full_name ?? "Cliente")]));
  const rows: BusyRow[] = (others ?? []).map((o) => ({
    start_time: String(o.start_time),
    duration_minutes: 60,
    client_name: names.get(String(o.client_id)) ?? "Cliente",
  }));
  const conflicts = findDelayConflicts(String(appt.start_time).slice(0, 5), duration, rows);
  if (conflicts.length > 0 && !acceptDelay) {
    return { needsConfirm: true as const, conflicts, duration };
  }

  const price = newPriceCents(Number(service.price_cents ?? 0), Number(appt.discount_percent ?? 0));
  const { error } = await db
    .from("appointments")
    .update({ service_id: service.id, price_cents: price })
    .eq("id", appointmentId);
  if (error) throw new Error("Não foi possível salvar o novo procedimento.");

  let calendar: "ok" | "falhou" = "ok";
  try {
    const { syncAppointmentToCalendar } = await import("./calendar-helpers.server");
    await syncAppointmentToCalendar(appointmentId);
  } catch (e) {
    console.error("Falha ao atualizar Google Agenda na troca de procedimento", e);
    calendar = "falhou";
  }
  return {
    needsConfirm: false as const,
    conflicts,
    duration,
    priceCents: price,
    serviceName: String(service.name),
    calendar,
  };
}
