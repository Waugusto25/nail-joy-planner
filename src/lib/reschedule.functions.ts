import { createServerFn } from "@tanstack/react-start";

import { requireServerSupabaseAuth } from "./supabase-auth-middleware";
import {
  adminRescheduleInput,
  decideRescheduleInput,
  requestRescheduleInput,
} from "./reschedule-schemas";

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Acesso restrito à administradora.");
}

/** Cliente solicita alteração de data/horário com justificativa. */
export const requestRescheduleFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => requestRescheduleInput.parse(data))
  .handler(async ({ data, context }) => {
    const { requestReschedule } = await import("./reschedule-helpers.server");
    return requestReschedule(
      context.userId,
      data.appointmentId,
      data.day,
      data.startTime,
      data.reason,
    );
  });

/** Administradora aprova ou recusa um pedido de reagendamento. */
export const decideRescheduleFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => decideRescheduleInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { decideReschedule } = await import("./reschedule-helpers.server");
    return decideReschedule(data.requestId, data.approve);
  });

/** Reagendamento direto pela administradora, já confirmado. */
export const adminRescheduleFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => adminRescheduleInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { adminReschedule } = await import("./reschedule-helpers.server");
    return adminReschedule(data.appointmentId, data.day, data.startTime);
  });