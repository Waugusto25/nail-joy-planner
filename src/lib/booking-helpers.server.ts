import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function admin(): SupabaseClient {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Returns only the busy start times for a day — never client identities. */
export async function busyTimes(day: string) {
  const db = admin();
  const { data } = await db
    .from("appointments")
    .select("start_time, status")
    .eq("day", day)
    .in("status", ["pendente", "confirmado", "concluido"]);
  return (data ?? []).map((r) => String(r.start_time).slice(0, 5));
}