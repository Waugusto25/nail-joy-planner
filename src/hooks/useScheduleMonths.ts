import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ScheduleMonth = {
  id: string;
  month: string;
  active: boolean;
  message: string | null;
};

/** Meses com atendimento ligado/desligado pela administradora. */
export function useScheduleMonths() {
  return useQuery({
    queryKey: ["schedule-months"],
    queryFn: async (): Promise<ScheduleMonth[]> => {
      const { data, error } = await supabase
        .from("schedule_months")
        .select("id, month, active, message")
        .order("month");
      if (error) throw error;
      return (data ?? []) as ScheduleMonth[];
    },
  });
}
