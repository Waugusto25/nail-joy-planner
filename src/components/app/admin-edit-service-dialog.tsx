import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase-client";
import { changeAppointmentServiceFn } from "@/lib/reschedule.functions";
import { formatDuration, formatPrice, shortTime } from "@/lib/salon";
import { endTime, type DelayConflict } from "@/lib/service-change";

type Props = {
  appointment: {
    id: string;
    start_time: string;
    serviceId: string;
    serviceName: string;
    durationMinutes: number;
    priceCents: number;
    clientName: string;
  };
};

/** Troca o procedimento (valor e tempo) e avisa se vai atrasar outra cliente. */
export function AdminEditServiceDialog({ appointment }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(appointment.serviceId);
  const [conflicts, setConflicts] = useState<DelayConflict[] | null>(null);
  const [saving, setSaving] = useState(false);

  const services = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const selected = (services.data ?? []).find((s) => s.id === serviceId);
  const newDuration = Number(selected?.duration_minutes ?? appointment.durationMinutes);
  const diff = newDuration - appointment.durationMinutes;
  const start = shortTime(appointment.start_time);

  async function save(acceptDelay: boolean) {
    setSaving(true);
    try {
      const r = await changeAppointmentServiceFn({
        data: { appointmentId: appointment.id, serviceId, acceptDelay },
      });
      if (r.needsConfirm) {
        setConflicts(r.conflicts);
        return;
      }
      await queryClient.invalidateQueries();
      toast.success(
        r.calendar === "ok"
          ? "Procedimento alterado e agenda atualizada."
          : "Procedimento alterado. Não foi possível atualizar a Google Agenda.",
      );
      setConflicts(null);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setConflicts(null);
        if (v) setServiceId(appointment.serviceId);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil size={16} /> Editar procedimento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar procedimento</DialogTitle>
          <DialogDescription>
            {appointment.clientName} · atual: {appointment.serviceName} (
            {formatPrice(appointment.priceCents)} · {formatDuration(appointment.durationMinutes)})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Novo procedimento</Label>
          <div className="grid gap-2" role="radiogroup">
            {(services.data ?? [])
              .filter((s) => s.active || s.id === appointment.serviceId)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={s.id === serviceId}
                  onClick={() => {
                    setServiceId(s.id);
                    setConflicts(null);
                  }}
                  className={`rounded-xl border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    s.id === serviceId ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-muted-foreground">
                    {formatPrice(Number(s.price_cents ?? 0))} ·{" "}
                    {formatDuration(Number(s.duration_minutes ?? 60))}
                  </span>
                </button>
              ))}
          </div>
          {selected && serviceId !== appointment.serviceId ? (
            <p className="text-sm text-muted-foreground">
              Novo horário: {start} às {endTime(start, newDuration)}.{" "}
              {diff < 0
                ? `Libera ${formatDuration(-diff)} na agenda.`
                : diff > 0
                  ? `Usa ${formatDuration(diff)} a mais.`
                  : "Mesmo tempo."}
            </p>
          ) : null}
          {conflicts ? (
            <div className="rounded-xl border border-destructive bg-destructive/10 p-3 text-sm">
              <p className="font-medium">⚠️ Pode atrasar outro atendimento:</p>
              <ul className="mt-1 list-disc pl-5">
                {conflicts.map((c) => (
                  <li key={`${c.clientName}-${c.startTime}`}>
                    {c.clientName} às {c.startTime} — atraso de cerca de{" "}
                    {formatDuration(c.overlapMinutes)}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConflicts(null)}>
                  Cancelar
                </Button>
                <Button size="sm" disabled={saving} onClick={() => void save(true)}>
                  Aceitar atraso e salvar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="w-full"
              disabled={saving || serviceId === appointment.serviceId}
              onClick={() => void save(false)}
            >
              {saving ? "Salvando..." : "Salvar procedimento"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
