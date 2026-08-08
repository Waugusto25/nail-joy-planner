import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cancelInput } from "./cancel-schemas";

/** Cancelamento feito pela própria cliente: libera a vaga, limpa a Google Agenda e avisa a admin. */
export const clientCancelAppointmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cancelInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: appt, error: readError } = await context.supabase
      .from("appointments")
      .select("id, client_id, day, start_time, status")
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (readError || !appt) throw new Error("Agendamento não encontrado.");
    if (appt.client_id !== context.userId) throw new Error("Este agendamento não é seu.");
    if (appt.status === "concluido") throw new Error("Atendimentos concluídos não podem ser cancelados.");

    const { error } = await context.supabase
      .from("appointments")
      .update({
        status: "cancelado",
        cancelled_at: new Date().toISOString(),
        cancelled_by: "cliente",
      })
      .eq("id", data.appointmentId);
    if (error) throw new Error("Não foi possível cancelar agora.");

    let adminAlert: { phone: string; message: string } | null = null;
    try {
      const { notifyAdminsClientCancellation } = await import("./cancel-helpers.server");
      const notice = await notifyAdminsClientCancellation(data.appointmentId);
      if (notice.alert) adminAlert = { phone: notice.phone, message: notice.alert };
    } catch (pushError) {
      console.error("Falha ao avisar a administradora do cancelamento", pushError);
    }

    let calendar: "ok" | "falhou" = "ok";
    try {
      const { removeAppointmentFromCalendar } = await import("./calendar-helpers.server");
      await removeAppointmentFromCalendar(data.appointmentId);
    } catch (calendarError) {
      console.error("Falha ao remover da Google Agenda", calendarError);
      calendar = "falhou";
    }

    return { day: String(appt.day), start: String(appt.start_time), calendar, adminAlert };
  });

/** Oculta um cancelamento do histórico da cliente (dado permanece no banco). */
export const hideCancelledForClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cancelInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("appointments")
      .update({ client_hidden_at: new Date().toISOString() })
      .eq("id", data.appointmentId)
      .eq("client_id", context.userId)
      .eq("status", "cancelado");
    if (error) throw new Error("Não foi possível remover do histórico.");
    return { ok: true };
  });

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Acesso restrito à administradora.");
}

/** Oculta um cancelamento do painel da administradora. */
export const hideCancelledForAdminFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cancelInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase
      .from("appointments")
      .update({ admin_hidden_at: new Date().toISOString() })
      .eq("id", data.appointmentId)
      .eq("status", "cancelado");
    if (error) throw new Error("Não foi possível remover do painel.");
    return { ok: true };
  });

/** Limpa todos os cancelamentos visíveis no painel da administradora. */
export const clearCancelledForAdminFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { error, count } = await context.supabase
      .from("appointments")
      .update({ admin_hidden_at: new Date().toISOString() }, { count: "exact" })
      .eq("status", "cancelado")
      .is("admin_hidden_at", null);
    if (error) throw new Error("Não foi possível limpar a lista.");
    return { cleared: count ?? 0 };
  });
