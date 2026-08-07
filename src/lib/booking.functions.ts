import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dayInput } from "./booking-schemas";

export const busyTimesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => dayInput.parse(data))
  .handler(async ({ data }) => {
    const { busyTimes } = await import("./booking-helpers.server");
    return { busy: await busyTimes(data.day) };
  });
