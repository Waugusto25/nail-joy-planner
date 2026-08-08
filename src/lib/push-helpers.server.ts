import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { addMinutes, formatDayLabel, formatPrice, shortTime } from "./salon";

export function admin(): SupabaseClient {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
        const response = await fetch(row.endpoint, payload);
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

  if (dead.length > 0) await db.from("push_subscriptions").delete().in("id", dead);
  return { sent, removed: dead.length };
}

async function subscriptionsFor(db: SupabaseClient, userIds: string[]) {
  if (userIds.length === 0) return [];
  const { data } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  return (data ?? []) as Row[];
}

/** Avisa a administradora sobre um novo pré-agendamento. */
export async function notifyAdminsNewAppointment(appointmentId: string) {
  const db = admin();
  const { data: appt } = await db
    .from("appointments")
    .select("id, client_id, day, start_time, price_cents, services(name, duration_minutes)")
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
  const { data: admins } = await db.from("user_roles").select("user_id").eq("role", "admin");
  const rows = await subscriptionsFor(db, (admins ?? []).map((r) => String(r.user_id)));

  return sendToSubscriptions(db, rows, {
    title: "Novo pré-agendamento 💅",
    body: `${client?.full_name ?? "Cliente"} — ${service?.name ?? "Procedimento"}\n${formatDayLabel(String(appt.day))} às ${start} (até ${end}) • ${formatPrice(Number(appt.price_cents))}`,
    url: "/admin",
    tag: `novo-${appointmentId}`,
  });
}

/** Envia lembretes para atendimentos confirmados que começam em ~24h. */
export async function sendDueReminders() {
  const db = admin();
  const { data } = await db
    .from("appointments")
    .select("id, client_id, day, start_time, services(name)")
    .eq("status", "confirmado")
    .is("reminder_sent_at", null);

  const now = Date.now();
  const pending = (data ?? []).filter((row) => {
    const start = shortTime(String(row.start_time));
    const at = new Date(`${row.day}T${start}:00-03:00`).getTime();
    const diff = at - now;
    return diff > 0 && diff <= 24 * 60 * 60 * 1000;
  });

  let sent = 0;
  for (const row of pending) {
    const joined = (row as { services: unknown }).services;
    const service = (Array.isArray(joined) ? joined[0] : joined) as { name: string } | null;
    const rows = await subscriptionsFor(db, [String(row.client_id)]);
    const start = shortTime(String(row.start_time));
    const result = await sendToSubscriptions(db, rows, {
      title: "Seu atendimento é amanhã ✨",
      body: `${service?.name ?? "Procedimento"} • ${formatDayLabel(String(row.day))} às ${start}.\nCancelamentos ou remarcações precisam ser avisados com pelo menos 24h de antecedência.`,
      url: "/painel",
      tag: `lembrete-${row.id}`,
    });
    sent += result.sent;
    await db
      .from("appointments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  return { checked: pending.length, sent };
}
