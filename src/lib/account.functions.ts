import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { claimEventPrizeInput, updateMyAccountInput } from "./account-schemas";

export const updateMyAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateMyAccountInput.parse(data))
  .handler(async ({ data, context }) => {
    const { updateMyAccount } = await import("./account-helpers.server");
    return updateMyAccount(context.userId, data.phone, data.email);
  });

export const claimEventPrizeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => claimEventPrizeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { claimEventPrize } = await import("./account-helpers.server");
    return claimEventPrize(context.userId, data.eventId, data.appointmentId);
  });
