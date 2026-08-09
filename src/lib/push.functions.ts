import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { appointmentIdOnly, endpointInput, subscriptionInput } from "./push-schemas";

/** Guarda (ou atualiza) o dispositivo que aceitou receber notificações. */
export const savePushSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => subscriptionInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error("Não foi possível ativar as notificações.");
    return { ok: true as const };
  });

/** Remove o dispositivo da lista de notificações. */
export const removePushSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => endpointInput.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint);
    return { ok: true as const };
  });

/** Dispara o alerta imediato para a administradora após um novo pré-agendamento. */
export const notifyNewAppointmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => appointmentIdOnly.parse(data))
  .handler(async ({ data, context }) => {
    const { data: appt } = await context.supabase
      .from("appointments")
      .select("id")
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (!appt) return { sent: 0 };
    const { notifyAdminsNewAppointment } = await import("./push-helpers.server");
    // Pré-agendamento também vai para a Google Agenda, em azul (pendente).
    try {
      const { syncAppointmentToCalendar } = await import("./calendar-helpers.server");
      await syncAppointmentToCalendar(data.appointmentId);
    } catch (calendarError) {
      console.error("Falha ao publicar o pré-agendamento na Google Agenda", calendarError);
    }
    try {
      return await notifyAdminsNewAppointment(data.appointmentId);
    } catch (error) {
      console.error("Falha ao notificar a administradora", error);
      return { sent: 0 };
    }
  });

/** Envio de teste para o próprio dispositivo (usado no painel). */
export const sendTestPushFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    const { admin, sendToSubscriptions } = await import("./push-helpers.server");
    return sendToSubscriptions(admin(), (data ?? []) as never, {
      title: "Notificações ativadas ✅",
      body: "Você vai receber os avisos do Jannah Nails por aqui.",
      url: "/painel",
    });
  });
