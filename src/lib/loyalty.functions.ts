import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  completeAppointmentInput,
  consumeReferralInput,
  drawWinnerInput,
} from "./loyalty-schemas";

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data: isAdmin } = await (
    context.supabase.rpc as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: boolean | null }>
  )("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Acesso restrito à administradora.");
}

export const completeAppointmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => completeAppointmentInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { completeAppointment } = await import("./loyalty-helpers.server");
    return completeAppointment(data.appointmentId);
  });

export const drawEventWinnerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => drawWinnerInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { drawEventWinner } = await import("./loyalty-helpers.server");
    return drawEventWinner(data.eventId);
  });

export const consumeReferralFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => consumeReferralInput.parse(data))
  .handler(async ({ data, context }) => {
    const { consumeReferralCoupon } = await import("./loyalty-helpers.server");
    return consumeReferralCoupon(context.userId, data.appointmentId);
  });