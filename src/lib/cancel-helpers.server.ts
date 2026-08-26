import { admin, adminTargets, sendToSubscriptions } from "./push-helpers.server";
import { adminCancellationAlert } from "./salon";

/** Avisa a administradora (push) que a cliente cancelou o atendimento. */
export async function notifyAdminsClientCancellation(appointmentId: string) {
  const db = admin();
  const { data: appt } = await db
    .from("appointments")
    .select("id, client_id, day, start_time, services(name, duration_minutes)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return { sent: 0, alert: null, phone: null, name: "Cliente" };

  const joined = (appt as { services: unknown }).services;
  const service = (Array.isArray(joined) ? joined[0] : joined) as
    | { name: string; duration_minutes: number }
    | null;
  const { data: client } = await db
    .from("profiles")
    .select("full_name, phone")
    .eq("id", appt.client_id)
    .maybeSingle();

  const alert = adminCancellationAlert({
    name: String(client?.full_name ?? "Cliente"),
    day: String(appt.day),
    start: String(appt.start_time),
    durationMinutes: Number(service?.duration_minutes ?? 60),
    serviceName: service?.name ?? "Procedimento",
  });

  const rows = await adminTargets(db);

  const result = await sendToSubscriptions(db, rows, {
    title: "⚠️ Cancelamento pela cliente",
    body: alert,
    url: "/admin",
    tag: `cancelado-cliente-${appointmentId}`,
  });

  return {
    sent: result.sent,
    alert,
    phone: String(client?.phone ?? ""),
    name: String(client?.full_name ?? "Cliente"),
  };
}
