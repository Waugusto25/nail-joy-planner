import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireServerSupabaseAuth } from "./supabase-auth-middleware";
import { manualAppointmentInput } from "./manual-booking-schemas";

export const manualScheduleFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso restrito à administradora.");
    const { readManualSchedule } = await import("./manual-availability.server");
    return readManualSchedule(context.supabase, data.month);
  });

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
