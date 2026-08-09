import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { INSTAGRAM_URL, WHATSAPP_NUMBER, setSalonContact } from "@/lib/salon";

export type AppSettings = {
  loyalty_enabled: boolean;
  referral_enabled: boolean;
  benefit_expiry_days: number;
  max_advance_months: number;
  instagram_url: string;
  whatsapp_number: string;
};

export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select(
          "loyalty_enabled, referral_enabled, benefit_expiry_days, max_advance_months, instagram_url, whatsapp_number",
        )
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      setSalonContact({ whatsapp: data?.whatsapp_number, instagram: data?.instagram_url });
      return {
        loyalty_enabled: data?.loyalty_enabled ?? true,
        referral_enabled: data?.referral_enabled ?? true,
        benefit_expiry_days: data?.benefit_expiry_days ?? 90,
        max_advance_months: data?.max_advance_months ?? 2,
        instagram_url: data?.instagram_url ?? INSTAGRAM_URL,
        whatsapp_number: data?.whatsapp_number ?? WHATSAPP_NUMBER,
      };
    },
  });
}