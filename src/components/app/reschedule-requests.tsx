import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase-client";
import { decideRescheduleFn } from "@/lib/reschedule.functions";
import { formatDayLabel, rescheduleMessage, shortTime, whatsappLinkTo } from "@/lib/salon";

/** Pedidos de reagendamento das clientes, destacados na aba de pendências. */
export function RescheduleRequests() {
  const queryClient = useQueryClient();
  const requests = useQuery({
    queryKey: ["reschedule-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reschedule_requests")
        .select("*")
        .eq("status", "pendente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const clients = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  async function decide(requestId: string, approve: boolean) {
    try {
      const result = await decideRescheduleFn({ data: { requestId, approve } });
      await queryClient.invalidateQueries();
      toast.success(approve ? "Reagendamento aprovado e confirmado." : "Pedido recusado.");
      if (approve && result.moved) {
        const link = whatsappLinkTo(
          result.moved.client.phone,
          rescheduleMessage({
            name: result.moved.client.name,
            serviceName: result.moved.serviceName,
            oldDay: result.moved.oldDay,
            oldStart: result.moved.oldStart,
            day: result.moved.day,
            start: result.moved.startTime,
            durationMinutes: result.moved.durationMinutes,
          }),
        );
        if (link) window.open(link, "_blank", "noopener");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível decidir agora.");
    }
  }

  const rows = requests.data ?? [];
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const client = (clients.data ?? []).find((c) => c.id === r.client_id) ?? null;
        return (
          <article key={r.id} className="surface-card border-primary/40 p-4">
            <Badge className="mb-1.5">🔄 Pedido de Reagendamento</Badge>
            <p className="font-display text-lg">{client?.full_name ?? "Cliente"}</p>
            <p className="text-sm capitalize text-muted-foreground">
              Horário atual: {formatDayLabel(r.old_day)} às {shortTime(r.old_start_time)}
            </p>
            <p className="text-sm capitalize">
              Nova opção: {formatDayLabel(r.requested_day)} às {shortTime(r.requested_start_time)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Motivo: {r.reason}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void decide(r.id, true)}>
                Aprovar novo horário
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void decide(r.id, false)}>
                Recusar
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}