import { createServerFn } from "@tanstack/react-start";

import { requireServerSupabaseAuth } from "./supabase-auth-middleware";
import {
  calendarEmailInput,
  claimEventPrizeInput,
  decideEmailChangeInput,
  requestEmailChangeInput,
  updateMyAccountInput,
} from "./account-schemas";

export const updateMyAccountFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => updateMyAccountInput.parse(data))
  .handler(async ({ data, context }) => {
    const { updateMyAccount } = await import("./account-helpers.server");
    return updateMyAccount(context.userId, data.phone, data.email);
  });

export const claimEventPrizeFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => claimEventPrizeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { claimEventPrize } = await import("./account-helpers.server");
    return claimEventPrize(context.userId, data.eventId, data.appointmentId);
  });

/** Cliente pede a troca do e-mail fixo; a administradora aprova depois. */

/** Salva o e-mail informado no pop-up de sincronização com a Google Agenda. */
export const setMyCalendarEmailFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => calendarEmailInput.parse(data))
  .handler(async ({ data, context }) => {
    const { setMyCalendarEmail } = await import("./account-helpers.server");
    return setMyCalendarEmail(context.userId, data.email);
  });

/** Cliente escolheu não ver mais o aviso da Google Agenda. */
export const dismissCalendarPromptFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .handler(async ({ context }) => {
    const { dismissCalendarPrompt } = await import("./account-helpers.server");
    return dismissCalendarPrompt(context.userId);
  });

export const requestEmailChangeFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => requestEmailChangeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { requestEmailChange } = await import("./account-helpers.server");
    return requestEmailChange(context.userId, data.requestedEmail);
  });

/** Administradora aprova ou recusa um pedido de troca de e-mail. */
export const decideEmailChangeFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => decideEmailChangeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito à administradora.");
    const { decideEmailChange } = await import("./account-helpers.server");
    return decideEmailChange(data.requestId, data.approve);
  });
