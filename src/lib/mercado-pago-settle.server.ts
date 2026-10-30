// Baixa de parcela a partir de um pagamento confirmado no Mercado Pago.
// A fonte da verdade é sempre a API do Mercado Pago (nunca o corpo do webhook),
// assim uma notificação forjada não consegue marcar parcela como paga.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export type MpPayment = {
  id: number;
  status: string;
  external_reference: string | null;
  transaction_amount: number;
  date_approved: string | null;
};

export async function fetchMpPayment(paymentId: string, token: string): Promise<MpPayment> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status}.`);
  return z.object({ id: z.number().int().positive(), status: z.string().max(80), external_reference: z.string().nullable(), transaction_amount: z.number().finite().positive(), date_approved: z.string().nullable() }).parse(await res.json());
}

export type SettleResult = "paid" | "already_paid" | "pending" | "not_found";

/** Idempotente: só dá baixa se a parcela ainda estiver em aberto. */
export async function settleFromMpPayment(
  db: SupabaseClient<Database>,
  payment: MpPayment,
): Promise<SettleResult> {
  const token = process.env["REMINDERS_SERVICE_TOKEN"];
  if (!token) throw new Error("Autorização da baixa automática não configurada.");
  const reference = z.string().uuid().nullable().parse(payment.external_reference);
  const { data, error } = await db.rpc("settle_verified_mp", {
    p_token: token,
    p_payment_id: String(payment.id),
    ...(reference ? { p_reference: reference } : {}),
    p_status: payment.status,
    p_amount_cents: Math.round(payment.transaction_amount * 100),
    ...(payment.date_approved ? { p_approved_at: payment.date_approved } : {}),
  });
  if (error) throw new Error(error.message);
  return z.enum(["paid", "already_paid", "pending", "not_found"]).parse(data);
}
