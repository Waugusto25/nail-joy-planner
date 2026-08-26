import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "./supabase-admin.server";

function admin(): SupabaseClient {
  return createAdminClient();
}

/** Returns only busy intervals (start + duration) for a day — never client identities. */
export async function busyTimes(day: string) {
  const db = admin();
  // Função segura no banco: devolve só intervalos, nunca a identidade das clientes.
  const { data } = await db.rpc("busy_times", { p_day: day });
  return ((data ?? []) as { start_time: string; duration_minutes: number }[]).map((r) => ({
    start: String(r.start_time).slice(0, 5),
    duration: Number(r.duration_minutes ?? 60),
  }));
}
