// Baixa de parcela a partir de um pagamento confirmado no Mercado Pago.
// A fonte da verdade é sempre a API do Mercado Pago (nunca o corpo do webhook),
// assim uma notificação forjada não consegue marcar parcela como paga.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
  return (await res.json()) as MpPayment;
}

export type SettleResult = "paid" | "already_paid" | "pending" | "not_found";

/** Idempotente: só dá baixa se a parcela ainda estiver em aberto. */
export async function settleFromMpPayment(
  db: SupabaseClient<Database>,
  payment: MpPayment,
): Promise<SettleResult> {
  const { data: parcel } = await db
    .from("store_order_installments")
    .select("id, paid_at, paid_amount_cents, mp_payment_id")
    .or(`mp_payment_id.eq.${payment.id}${payment.external_reference ? `,id.eq.${payment.external_reference}` : ""}`)
    .maybeSingle();
  if (!parcel) return "not_found";

  if (payment.status !== "approved") {
    await db.from("store_order_installments").update({ mp_status: payment.status }).eq("id", parcel.id);
    return "pending";
  }
  if (parcel.paid_at) {
    await db.from("store_order_installments").update({ mp_status: "approved" }).eq("id", parcel.id);
    return "already_paid";
  }
  const cents = Math.round(payment.transaction_amount * 100);
  const { error } = await db
    .from("store_order_installments")
    .update({
      mp_status: "approved",
      paid_at: payment.date_approved ?? new Date().toISOString(),
      paid_amount_cents: (parcel.paid_amount_cents ?? 0) + cents,
    })
    .eq("id", parcel.id)
    .is("paid_at", null);
  if (error) throw new Error(error.message);
  return "paid";
}
