import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireServerSupabaseAuth } from "./supabase-auth-middleware";

export const createUnifiedStoreOrderFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    orderId: z.string().uuid(), clientId: z.string().uuid(),
    items: z.array(z.object({ name: z.string().trim().min(1), unit_price_cents: z.number().int().positive() })).min(1),
    sources: z.array(z.object({ id: z.string().uuid(), remainingCents: z.number().int().positive() })).min(1),
    count: z.number().int().min(1).max(12), offset: z.number().int().min(0),
    firstDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paymentMethod: z.string(), status: z.string(), notes: z.string().max(280),
  }).parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: id, error } = await context.supabase.rpc("create_unified_store_order", {
      p_order_id: data.orderId, p_client_id: data.clientId, p_items: data.items, p_sources: data.sources,
      p_count: data.count, p_offset: data.offset, p_first_due: data.firstDue,
      p_payment_method: data.paymentMethod, p_status: data.status, p_notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return { id };
  });