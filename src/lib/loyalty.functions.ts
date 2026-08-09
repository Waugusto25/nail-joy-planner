import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  completeAppointmentInput,
  consumeReferralInput,
  drawWinnerInput,
  loyaltySpendInput,
} from "./loyalty-schemas";

export const completeAppointmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => completeAppointmentInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito à administradora.");
    const { completeAppointment } = await import("./loyalty-helpers.server");
    const result = await completeAppointment(data.appointmentId, data.paymentMethod);
    try {
      const { syncCalendarStatusColor } = await import("./calendar-helpers.server");
      await syncCalendarStatusColor(data.appointmentId);
    } catch (calendarError) {
      console.error("Falha ao atualizar a cor do evento na Google Agenda", calendarError);
    }
    return result;
  });

export const drawEventWinnerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => drawWinnerInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito à administradora.");
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
/** Queima os pontos de fidelidade usados no pré-agendamento da própria cliente. */
export const spendLoyaltyPointsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => loyaltySpendInput.parse(data))
  .handler(async ({ data, context }) => {
    const { spendLoyaltyPoints } = await import("./loyalty-wallet.server");
    return spendLoyaltyPoints(context.userId, data.appointmentId);
  });
