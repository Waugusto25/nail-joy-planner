import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { LOYALTY_CYCLE } from "./salon";

function admin(): SupabaseClient {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type BenefitNotification = {
  kind: "indicacao" | "fidelidade";
  phone: string;
  name: string;
  detail: string;
};

async function settings(db: SupabaseClient) {
  const { data } = await db.from("app_settings").select("*").eq("id", true).maybeSingle();
  return {
    loyaltyEnabled: Boolean(data?.loyalty_enabled ?? true),
    referralEnabled: Boolean(data?.referral_enabled ?? true),
    expiryDays: Number(data?.benefit_expiry_days ?? 90),
  };
}

/**
 * Conclui um atendimento e libera os benefícios ganhos:
 * - a indicação só vira cupom depois que a amiga indicada conclui o 1º atendimento (antifraude);
 * - a cada ciclo completo de procedimentos, avisa a fidelidade.
 */
export async function completeAppointment(appointmentId: string) {
  const db = admin();
  const { data: appt } = await db
    .from("appointments")
    .select("id, client_id, service_id, status")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) throw new Error("Agendamento não encontrado.");

  const { error } = await db
    .from("appointments")
    .update({ status: "concluido" })
    .eq("id", appointmentId);
  if (error) throw new Error("Não foi possível concluir o atendimento.");

  const config = await settings(db);
  const notifications: BenefitNotification[] = [];

  const { data: referral } = await db
    .from("referrals")
    .select("id, referrer_id")
    .eq("referred_id", appt.client_id)
    .eq("status", "pendente")
    .maybeSingle();

  if (referral && config.referralEnabled) {
    const now = new Date();
    await db
      .from("referrals")
      .update({
        status: "concluido",
        earned_at: now.toISOString(),
        expires_at: new Date(now.getTime() + config.expiryDays * 86400000).toISOString(),
      })
      .eq("id", referral.id);
    const { data: people } = await db
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", [referral.referrer_id, appt.client_id]);
    const referrer = (people ?? []).find((p) => p.id === referral.referrer_id);
    const referred = (people ?? []).find((p) => p.id === appt.client_id);
    if (referrer) {
      notifications.push({
        kind: "indicacao",
        phone: String(referrer.phone),
        name: String(referrer.full_name),
        detail: String(referred?.full_name ?? "sua amiga"),
      });
    }
  }

  if (config.loyaltyEnabled) {
    const { data: service } = await db
      .from("services")
      .select("name, loyalty_eligible")
      .eq("id", appt.service_id)
      .maybeSingle();
    if (service?.loyalty_eligible) {
      const since = new Date(Date.now() - config.expiryDays * 86400000)
        .toISOString()
        .slice(0, 10);
      const { data: done } = await db
        .from("appointments")
        .select("id")
        .eq("client_id", appt.client_id)
        .eq("service_id", appt.service_id)
        .eq("status", "concluido")
        .gte("day", since);
      const count = (done ?? []).length;
      if (count > 0 && count % LOYALTY_CYCLE === 0) {
        const { data: client } = await db
          .from("profiles")
          .select("full_name, phone")
          .eq("id", appt.client_id)
          .maybeSingle();
        if (client) {
          notifications.push({
            kind: "fidelidade",
            phone: String(client.phone),
            name: String(client.full_name),
            detail: String(service.name),
          });
        }
      }
    }
  }

  return { notifications };
}

/** Marca o cupom de indicação mais antigo (válido) como usado no agendamento informado. */
export async function consumeReferralCoupon(userId: string, appointmentId: string) {
  const db = admin();
  const nowIso = new Date().toISOString();
  const { data: coupon } = await db
    .from("referrals")
    .select("id")
    .eq("referrer_id", userId)
    .eq("status", "concluido")
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .order("earned_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!coupon) throw new Error("Você não tem cupom de indicação disponível.");
  await db
    .from("referrals")
    .update({ used_at: nowIso, used_appointment_id: appointmentId })
    .eq("id", coupon.id);
  return { ok: true };
}

/** Sorteia automaticamente entre as clientes com atendimento no período do evento. */
export async function drawEventWinner(eventId: string) {
  const db = admin();
  const { data: event } = await db
    .from("events")
    .select("id, starts_on, ends_on")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) throw new Error("Evento não encontrado.");

  const { data: appointments } = await db
    .from("appointments")
    .select("client_id")
    .gte("day", event.starts_on)
    .lte("day", event.ends_on)
    .in("status", ["confirmado", "concluido"]);
  const ids = [...new Set((appointments ?? []).map((a) => String(a.client_id)))];
  if (ids.length === 0) throw new Error("Nenhuma cliente participou no período do evento.");

  const { data: admins } = await db.from("user_roles").select("user_id").eq("role", "admin");
  const adminIds = new Set((admins ?? []).map((r) => String(r.user_id)));
  const pool = ids.filter((id) => !adminIds.has(id));
  if (pool.length === 0) throw new Error("Nenhuma cliente participou no período do evento.");

  const winnerId = pool[Math.floor(Math.random() * pool.length)]!;
  const { data: winner } = await db
    .from("profiles")
    .select("full_name, phone")
    .eq("id", winnerId)
    .maybeSingle();
  await db
    .from("events")
    .update({
      winner_id: winnerId,
      winner_name: winner?.full_name ?? "Cliente",
      drawn_at: new Date().toISOString(),
    })
    .eq("id", eventId);
  return {
    winnerName: String(winner?.full_name ?? "Cliente"),
    winnerPhone: String(winner?.phone ?? ""),
    participants: pool.length,
  };
}