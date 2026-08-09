import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { appointmentIdInput } from "./calendar-schemas";

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Acesso restrito à administradora.");
}

/** Confirma o atendimento e publica o compromisso na Google Agenda. */
export const confirmAppointmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => appointmentIdInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase
      .from("appointments")
      .update({ status: "confirmado" })
      .eq("id", data.appointmentId);
    if (error) throw new Error("Não foi possível confirmar o atendimento.");

    try {
      const { notifyClientStatusChange } = await import("./push-helpers.server");
      await notifyClientStatusChange(data.appointmentId, "confirmado");
    } catch (pushError) {
      console.error("Falha ao notificar a cliente da confirmação", pushError);
    }

    try {
      const { syncAppointmentToCalendar } = await import("./calendar-helpers.server");
      await syncAppointmentToCalendar(data.appointmentId);
      return { calendar: "ok" as const };
    } catch (calendarError) {
      console.error("Falha ao sincronizar com a Google Agenda", calendarError);
      return {
        calendar: "falhou" as const,
        calendarMessage:
          calendarError instanceof Error ? calendarError.message : "Erro na Google Agenda.",
      };
    }
  });

/** Cancela o atendimento e apaga o compromisso da Google Agenda. */
export const setAppointmentPendingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => appointmentIdInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase
      .from("appointments")
      .update({ status: "pendente" })
      .eq("id", data.appointmentId);
    if (error) throw new Error("Não foi possível atualizar o atendimento.");
    try {
      const { syncCalendarStatusColor } = await import("./calendar-helpers.server");
      await syncCalendarStatusColor(data.appointmentId);
    } catch (calendarError) {
      console.error("Falha ao atualizar a cor do evento na Google Agenda", calendarError);
    }
    return { ok: true };
  });

export const cancelAppointmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => appointmentIdInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase
      .from("appointments")
      .update({
        status: "cancelado",
        cancelled_at: new Date().toISOString(),
        cancelled_by: "admin",
      })
      .eq("id", data.appointmentId);
    if (error) throw new Error("Não foi possível cancelar o atendimento.");
    // Cancelamento/recusa pela administradora devolve os pontos de fidelidade.
    try {
      const { returnLoyaltyPoints } = await import("./loyalty-wallet.server");
      await returnLoyaltyPoints(data.appointmentId);
    } catch (walletError) {
      console.error("Falha ao devolver os pontos de fidelidade", walletError);
    }
    try {
      const { notifyClientStatusChange } = await import("./push-helpers.server");
      await notifyClientStatusChange(data.appointmentId, "cancelado");
    } catch (pushError) {
      console.error("Falha ao notificar a cliente do cancelamento", pushError);
    }
    try {
      const { markAppointmentCancelledInCalendar } = await import("./calendar-helpers.server");
      await markAppointmentCancelledInCalendar(data.appointmentId);
      return { calendar: "ok" as const };
    } catch (calendarError) {
      console.error("Falha ao marcar o cancelamento na Google Agenda", calendarError);
      return { calendar: "falhou" as const };
    }
  });
