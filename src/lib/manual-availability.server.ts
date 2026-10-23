import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManualSchedule } from "./manual-availability";
import { lastDayOfMonth } from "./months";

export async function readManualSchedule(db: SupabaseClient, month: string): Promise<ManualSchedule> {
  const results = await Promise.all([
    db.from("schedule_slots").select("weekday, start_time").eq("active", true),
    db.from("schedule_breaks").select("weekday, start_time, end_time").eq("active", true),
    db.from("blocked_dates").select("day").gte("day", `${month}-01`).lte("day", lastDayOfMonth(month)),
    db.from("special_days").select("day, times").eq("active", true).gte("day", `${month}-01`).lte("day", lastDayOfMonth(month)),
    db.from("appointments").select("day, start_time, services(duration_minutes)").gte("day", `${month}-01`).lte("day", lastDayOfMonth(month)).in("status", ["pendente", "confirmado", "concluido"]),
    db.from("schedule_months").select("active").eq("month", month).maybeSingle(),
  ]);
  for (const result of results) if (result.error) throw new Error("Não foi possível consultar a agenda. Tente novamente.");
  const [slots, breaks, blocked, special, busy, setting] = results;
  return {
    slots: slots?.data ?? [], breaks: breaks?.data ?? [],
    blocked: (blocked?.data ?? []).map((r: { day: string }) => r.day),
    special: special?.data ?? [], monthActive: setting?.data?.active ?? true,
    busy: (busy?.data ?? []).map((r: { day: string; start_time: string; services: unknown }) => {
      const joined = Array.isArray(r.services) ? r.services[0] : r.services;
      return { day: r.day, start_time: r.start_time, duration: Number((joined as { duration_minutes?: number } | null)?.duration_minutes ?? 60) };
    }),
  };
}