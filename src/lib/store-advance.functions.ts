import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireServerSupabaseAuth } from "./supabase-auth-middleware";

export const recordStoreAdvanceFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    installmentId: z.string().uuid(),
    amountCents: z.number().int().positive(),
    paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((day) => {
      const date = new Date(`${day}T12:00:00Z`);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
    }, "Data inválida"),
    requestId: z.string().uuid(),
  }).parse(data))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: id, error } = await context.supabase.rpc("record_store_advance", {
      p_installment_id: data.installmentId,
      p_amount_cents: data.amountCents,
      p_paid_on: data.paidOn,
      p_request_id: data.requestId,
    });
    if (error) throw new Error(error.message);
    return { id };
  });