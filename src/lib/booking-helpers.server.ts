import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function admin(): SupabaseClient {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Returns only busy intervals (start + duration) for a day — never client identities. */
export async function busyTimes(day: string) {
  const db = admin();
  const { data } = await db
    .from("appointments")
    .select("start_time, status, services(duration_minutes)")
    .eq("day", day)
    .in("status", ["pendente", "confirmado", "concluido"]);
  return (data ?? []).map((r) => {
    const joined = r.services as unknown;
    const service = Array.isArray(joined) ? joined[0] : joined;
    const duration = (service as { duration_minutes?: number } | null)?.duration_minutes;
    return {
      start: String(r.start_time).slice(0, 5),
      duration: Number(duration ?? 60),
    };
  });
}