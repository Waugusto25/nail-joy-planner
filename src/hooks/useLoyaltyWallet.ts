import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase-client";

export type LoyaltyPoint = { id: string; service_id: string; loyalty_expires_at: string | null };

/**
 * Pontos de fidelidade disponíveis da cliente: ganhos com o programa ativo,
 * ainda não queimados em um pré-agendamento e dentro da validade.
 */
export function useLoyaltyWallet(clientId?: string | undefined) {
  return useQuery({
    queryKey: ["loyalty-wallet", clientId],
    enabled: Boolean(clientId),
    queryFn: async (): Promise<LoyaltyPoint[]> => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, service_id, loyalty_expires_at")
        .eq("client_id", clientId!)
        .eq("loyalty_earned", true)
        .is("loyalty_spent_at", null)
        .gt("loyalty_expires_at", new Date().toISOString());
      if (error) throw error;
      return (data ?? []) as LoyaltyPoint[];
    },
  });
}
