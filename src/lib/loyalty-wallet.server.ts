import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { LOYALTY_CYCLE, LOYALTY_PARTIAL_STEP } from "./salon";

function admin(): SupabaseClient {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function expiryDays(db: SupabaseClient) {
  const { data } = await db
    .from("app_settings")
    .select("benefit_expiry_days")
    .eq("id", true)
    .maybeSingle();
  return Number(data?.benefit_expiry_days ?? 90);
}

/**
 * Queima os pontos de fidelidade usados no pré-agendamento informado.
 * Os pontos ficam vinculados ao agendamento para poderem voltar em caso de
 * cancelamento ou recusa.
 */
export async function spendLoyaltyPoints(userId: string, appointmentId: string) {
  const db = admin();
  const { data: appt } = await db
    .from("appointments")
    .select("id, client_id, service_id, benefit_type, discount_percent")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt || String(appt.client_id) !== userId) throw new Error("Agendamento não encontrado.");
  const type = String(appt.benefit_type ?? "nenhum");
  if (type !== "fidelidade" && type !== "parcial") return { spent: 0 };

  const needed =
    type === "fidelidade"
      ? LOYALTY_CYCLE
      : Math.max(1, Math.round(Number(appt.discount_percent ?? 0) / (LOYALTY_PARTIAL_STEP * 100)));

  const nowIso = new Date().toISOString();
  const { data: points } = await db
    .from("appointments")
    .select("id")
    .eq("client_id", userId)
    .eq("service_id", appt.service_id)
    .eq("loyalty_earned", true)
    .is("loyalty_spent_at", null)
    .gt("loyalty_expires_at", nowIso)
    .order("loyalty_expires_at", { ascending: true })
    .limit(needed);
  const ids = (points ?? []).map((p) => String(p.id));
  if (ids.length === 0) throw new Error("Você não tem pontos de fidelidade disponíveis.");
  if (ids.length < needed) throw new Error("Seus pontos de fidelidade já foram usados.");

  await db
    .from("appointments")
    .update({ loyalty_spent_at: nowIso, loyalty_spent_on: appointmentId })
    .in("id", ids);
  return { spent: ids.length };
}

/**
 * Devolve para a carteira da cliente os pontos queimados em um agendamento
 * cancelado ou recusado, renovando a validade a partir da data da devolução.
 */
export async function returnLoyaltyPoints(appointmentId: string) {
  const db = admin();
  const days = await expiryDays(db);
  const { data, error } = await db
    .from("appointments")
    .update({
      loyalty_spent_at: null,
      loyalty_spent_on: null,
      loyalty_expires_at: new Date(Date.now() + days * 86400000).toISOString(),
    })
    .eq("loyalty_spent_on", appointmentId)
    .select("id");
  if (error) return { returned: 0 };
  return { returned: (data ?? []).length };
}
