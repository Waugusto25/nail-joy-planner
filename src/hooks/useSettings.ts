import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AppSettings = {
  loyalty_enabled: boolean;
  referral_enabled: boolean;
  benefit_expiry_days: number;
};

export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("loyalty_enabled, referral_enabled, benefit_expiry_days")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return {
        loyalty_enabled: data?.loyalty_enabled ?? true,
        referral_enabled: data?.referral_enabled ?? true,
        benefit_expiry_days: data?.benefit_expiry_days ?? 90,
      };
    },
  });
}