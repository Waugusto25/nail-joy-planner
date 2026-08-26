import { createServerFn } from "@tanstack/react-start";

import { requireServerSupabaseAuth } from "./supabase-auth-middleware";
import { manualAppointmentInput } from "./manual-booking-schemas";

export const createManualAppointmentFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => manualAppointmentInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito à administradora.");
    const { createManualAppointment } = await import("./manual-booking-helpers.server");
    return createManualAppointment(data);
  });
