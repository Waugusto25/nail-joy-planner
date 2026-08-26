import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase-client";

export type SpecialDay = {
  id: string;
  day: string;
  reason: string | null;
  times: string[];
  active: boolean;
};

/**
 * Dias especiais de atendimento: valem só para a data exata cadastrada e têm
 * prioridade sobre a grade semanal padrão (não criam recorrência).
 */
export function useSpecialDays(options?: { includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive ?? false;
  return useQuery({
    queryKey: ["special-days", includeInactive],
    queryFn: async (): Promise<SpecialDay[]> => {
      let query = supabase
        .from("special_days")
        .select("id, day, reason, times, active")
        .order("day");
      if (!includeInactive) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        times: (row.times ?? []).map((t: string) => String(t).slice(0, 5)).sort(),
      })) as SpecialDay[];
    },
  });
}