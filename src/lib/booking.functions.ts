import { createServerFn } from "@tanstack/react-start";

import { requireServerSupabaseAuth } from "./supabase-auth-middleware";
import { dayInput } from "./booking-schemas";

export const busyTimesFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => dayInput.parse(data))
  .handler(async ({ data }) => {
    const { busyTimes } = await import("./booking-helpers.server");
    return { busy: await busyTimes(data.day) };
  });
