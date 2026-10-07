import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireServerSupabaseAuth } from "./supabase-auth-middleware";

const input = z.object({
  installmentId: z.string().uuid(),
  method: z.enum(["pix", "boleto"]),
  email: z.string().trim().email().optional().or(z.literal("")),
  cpf: z.string().optional(),
  // Endereço é exigido pelo Mercado Pago para registrar boleto.
  zipCode: z.string().optional(),
  street: z.string().optional(),
  streetNumber: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

type MpResponse = {
  id?: number;
  status?: string;
  message?: string;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
  transaction_details?: { digitable_line?: string; external_resource_url?: string };
  barcode?: { content?: string };
};

/** Gera cobrança real (Pix ou Boleto) no Mercado Pago para uma parcela da Loja. */
export const createMercadoPagoChargeFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const token = process.env["MERCADO_PAGO_ACCESS_TOKEN"];
    if (!token) throw new Error("Token do Mercado Pago não configurado.");

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { data: parcel, error } = await context.supabase
      .from("store_order_installments")
      .select("id, number, amount_cents, paid_amount_cents, due_date, order_id, store_orders!store_order_installments_order_id_fkey(client_name, client_phone)")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (error || !parcel) throw new Error("Parcela não encontrada.");

    const order = parcel.store_orders as unknown as { client_name: string; client_phone: string } | null;
    const fullName = (order?.client_name ?? "Cliente").trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(" ") || firstName;
    const phoneDigits = (order?.client_phone ?? "").replace(/\D/g, "");
    // Sem e-mail cadastrado, usamos um e-mail fictício estável por cliente.
    const email = data.email || `cliente${phoneDigits || parcel.id.slice(0, 8)}@jannahnails.com`;
    const amountCents = Math.max(parcel.amount_cents - (parcel.paid_amount_cents ?? 0), 0);
    if (amountCents <= 0) throw new Error("Esta parcela não tem valor em aberto.");

    const payer: Record<string, unknown> = { email, first_name: firstName, last_name: lastName };
    const body: Record<string, unknown> = {
      transaction_amount: amountCents / 100,
      description: `Jannah Nails — Parcela ${parcel.number}`,
      external_reference: parcel.id,
      // Webhook no endereço estável do app: o Mercado Pago avisa quando o pagamento cair.
      notification_url: "https://nail-joy-planner.lovable.app/api/public/hooks/mercado-pago",
      payment_method_id: data.method === "pix" ? "pix" : "bolbradesco",
      payer,
    };

    if (data.method === "boleto") {
      const cpf = (data.cpf ?? "").replace(/\D/g, "");
      if (cpf.length !== 11) throw new Error("Informe um CPF válido para gerar o boleto.");
      payer["identification"] = { type: "CPF", number: cpf };
      payer["address"] = {
        zip_code: (data.zipCode ?? "").replace(/\D/g, ""),
        street_name: data.street ?? "",
        street_number: data.streetNumber ?? "",
        neighborhood: data.neighborhood ?? "",
        city: data.city ?? "",
        federal_unit: (data.state ?? "").toUpperCase(),
      };
      if (parcel.due_date) body["date_of_expiration"] = `${parcel.due_date}T23:59:59.000-03:00`;
    }

    let mp: MpResponse;
    try {
      const res = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });
      mp = (await res.json()) as MpResponse;
      if (!res.ok) {
        console.error("Mercado Pago error", res.status, mp);
        throw new Error(mp.message ?? `Mercado Pago recusou (${res.status}).`);
      }
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Falha ao contatar o Mercado Pago.");
    }

    const tx = mp.point_of_interaction?.transaction_data;
    const update = {
      mp_payment_id: mp.id ? String(mp.id) : null,
      mp_method: data.method,
      mp_status: mp.status ?? null,
      pix_copia_e_cola: data.method === "pix" ? tx?.qr_code ?? null : null,
      pix_qr_code_base64: data.method === "pix" ? tx?.qr_code_base64 ?? null : null,
      boleto_linha_digitavel:
        data.method === "boleto"
          ? mp.transaction_details?.digitable_line ?? mp.barcode?.content ?? null
          : null,
      boleto_pdf_url:
        data.method === "boleto" ? mp.transaction_details?.external_resource_url ?? null : null,
    };
    const { error: saveError } = await context.supabase
      .from("store_order_installments")
      .update(update)
      .eq("id", parcel.id);
    if (saveError) throw new Error("Cobrança gerada, mas não foi possível salvá-la.");
    return update;
  });

/** Consulta manual: confere no Mercado Pago e dá baixa se já foi pago. */
export const checkMercadoPagoPaymentFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ installmentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const token = process.env["MERCADO_PAGO_ACCESS_TOKEN"];
    if (!token) throw new Error("Token do Mercado Pago não configurado.");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito.");
    const { data: parcel } = await context.supabase
      .from("store_order_installments")
      .select("mp_payment_id")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (!parcel?.mp_payment_id) throw new Error("Esta parcela não tem cobrança do Mercado Pago.");
    const { fetchMpPayment, settleFromMpPayment } = await import("./mercado-pago-settle.server");
    const payment = await fetchMpPayment(parcel.mp_payment_id, token);
    const result = await settleFromMpPayment(context.supabase, payment);
    return { result, status: payment.status };
  });
