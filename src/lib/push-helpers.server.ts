import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  addMinutes,
  cancellationMessage,
  claimTag,
  confirmationMessage,
  formatDayLabel,
  formatPrice,
  shortTime,
} from "./salon";
import { createAdminClient } from "./supabase-admin.server";

export function admin(): SupabaseClient {
  return createAdminClient();
}

function vapid() {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  if (!publicKey || !privateKey) throw new Error("Chaves de notificação não configuradas.");
  return {
    subject: process.env["VAPID_SUBJECT"] ?? "mailto:jannahsilva.oliveira@gmail.com",
    publicKey,
    privateKey,
  };
}

type Row = { id: string; endpoint: string; p256dh: string; auth: string };
export type Notice = { title: string; body: string; url?: string; tag?: string };

/** Envia a notificação para todos os dispositivos informados, limpando inscrições mortas. */
export async function sendToSubscriptions(db: SupabaseClient, rows: Row[], notice: Notice) {
  if (rows.length === 0) return { sent: 0, removed: 0 };
  const keys = vapid();
  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    rows.map(async (row) => {
      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        const payload = await buildPushPayload(
          { data: notice, options: { ttl: 60 * 60 * 12, urgency: "high" } },
          subscription,
          keys,
        );
        const response = await fetch(row.endpoint, {
          method: payload.method,
          headers: payload.headers as unknown as Record<string, string>,
          body: payload.body as unknown as BodyInit,
        });
        if (response.status === 404 || response.status === 410) {
          dead.push(row.id);
          return;
        }
        if (!response.ok) {
          console.error(`Push falhou [${response.status}]: ${await response.text()}`);
          return;
        }
        sent += 1;
      } catch (error) {
        console.error("Erro ao enviar notificação", error);
      }
    }),
  );

  if (dead.length > 0) await db.rpc("drop_push_subscriptions", { p_ids: dead });
  return { sent, removed: dead.length };
}

/** Dispositivos da administradora (resolvidos no banco, sem expor inscrições alheias). */
export async function adminTargets(db: SupabaseClient) {
  const { data } = await db.rpc("push_admin_targets");
  return (data ?? []) as Row[];
}

/** Dispositivos de uma cliente: permitido para ela mesma ou para a administradora. */
async function clientTargets(db: SupabaseClient, clientId: string) {
  const { data } = await db.rpc("push_client_targets", { p_client: clientId });
  return (data ?? []) as Row[];
}

/** Avisa a administradora sobre um novo pré-agendamento. */
export async function notifyAdminsNewAppointment(appointmentId: string) {
  const db = admin();
  const { data: appt } = await db
    .from("appointments")
    .select(
      "id, client_id, day, start_time, price_cents, benefit_type, discount_percent, services(name, duration_minutes)",
    )
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return { sent: 0 };

  const joined = (appt as { services: unknown }).services;
  const service = (Array.isArray(joined) ? joined[0] : joined) as
    | { name: string; duration_minutes: number }
    | null;
  const { data: client } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", appt.client_id)
    .maybeSingle();

  const start = shortTime(String(appt.start_time));
  const end = addMinutes(start, Number(service?.duration_minutes ?? 60));
  const rows = await adminTargets(db);

  const tag = claimTag(String(appt.benefit_type ?? "nenhum"));
  const percent = Number(appt.discount_percent ?? 0);
  const claimLine = tag
    ? `\n${tag}${percent > 0 ? ` (-${percent}%)` : ""} — confira o benefício no painel.`
    : "";

  return sendToSubscriptions(db, rows, {
    title: tag ? `Novo pré-agendamento com ${tag}` : "Novo pré-agendamento 💅",
    body: `${client?.full_name ?? "Cliente"} — ${service?.name ?? "Procedimento"}\n${formatDayLabel(String(appt.day))} às ${start} (até ${end}) • ${formatPrice(Number(appt.price_cents))}${claimLine}`,
    url: "/admin",
    tag: `novo-${appointmentId}`,
  });
}

/** Envia lembretes para atendimentos confirmados que começam em ~24h. */
export async function notifyClientStatusChange(
  appointmentId: string,
  kind: "confirmado" | "cancelado",
) {
  const db = admin();
  const { data: appt } = await db
    .from("appointments")
    .select("id, client_id, day, start_time, services(name, duration_minutes)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return { sent: 0 };

  const joined = (appt as { services: unknown }).services;
  const service = (Array.isArray(joined) ? joined[0] : joined) as
    | { name: string; duration_minutes: number }
    | null;
  const { data: client } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", appt.client_id)
    .maybeSingle();

  const notice = {
    name: String(client?.full_name ?? "linda"),
    day: String(appt.day),
    start: String(appt.start_time),
    durationMinutes: Number(service?.duration_minutes ?? 60),
    serviceName: service?.name ?? "Procedimento",
  };
  const rows = await clientTargets(db, String(appt.client_id));

  return sendToSubscriptions(db, rows, {
    title: kind === "confirmado" ? "Horário confirmado 💖" : "Horário cancelado 💗",
    body: kind === "confirmado" ? confirmationMessage(notice) : cancellationMessage(notice),
    url: "/painel",
    tag: `${kind}-${appointmentId}`,
  });
}

type ReminderTarget = {
  appointment_id: string;
  day: string;
  start_time: string;
  service_name: string | null;
  subscription_id: string | null;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
};

/**
 * Lembretes automáticos: sem credencial privada, o cron se autentica com um
 * token de serviço validado dentro das funções do banco.
 */
export async function sendDueReminders(serviceToken: string) {
  const db = admin();
  const { data, error } = await db.rpc("due_reminder_targets", { p_token: serviceToken });
  if (error) throw new Error("Token de lembretes inválido.");

  const now = Date.now();
  const byAppointment = new Map<string, { row: ReminderTarget; devices: Row[] }>();
  for (const target of (data ?? []) as ReminderTarget[]) {
    const start = shortTime(String(target.start_time));
    const at = new Date(`${target.day}T${start}:00-03:00`).getTime();
    const diff = at - now;
    if (diff <= 0 || diff > 24 * 60 * 60 * 1000) continue;
    const entry = byAppointment.get(target.appointment_id) ?? { row: target, devices: [] };
    if (target.subscription_id && target.endpoint && target.p256dh && target.auth) {
      entry.devices.push({
        id: target.subscription_id,
        endpoint: target.endpoint,
        p256dh: target.p256dh,
        auth: target.auth,
      });
    }
    byAppointment.set(target.appointment_id, entry);
  }

  let sent = 0;
  for (const [appointmentId, entry] of byAppointment) {
    const start = shortTime(String(entry.row.start_time));
    const result = await sendToSubscriptions(db, entry.devices, {
      title: "Seu atendimento é amanhã ✨",
      body: `${entry.row.service_name ?? "Procedimento"} • ${formatDayLabel(String(entry.row.day))} às ${start}.\nCancelamentos ou remarcações precisam ser avisados com pelo menos 24h de antecedência.`,
      url: "/painel",
      tag: `lembrete-${appointmentId}`,
    });
    sent += result.sent;
    await db.rpc("mark_reminder_sent", { p_token: serviceToken, p_appointment: appointmentId });
  }

  return { checked: byAppointment.size, sent };
}
