import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSpecialDays } from "@/hooks/useSpecialDays";
import { adminRescheduleFn } from "@/lib/reschedule.functions";
import { formatDayLabel, rescheduleMessage, shortTime, whatsappLinkTo } from "@/lib/salon";

function weekdayOf(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).getDay();
}

/**
 * Reagendamento direto da administradora: qualquer data e horário, sem a trava
 * de 72h. O novo horário entra confirmado, avisa a cliente e atualiza a agenda.
 */
export function AdminRescheduleDialog({
  appointment,
}: {
  appointment: {
    id: string;
    day: string;
    start_time: string;
    serviceName: string;
    clientName: string;
  };
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(appointment.day);
  const [time, setTime] = useState(shortTime(appointment.start_time));
  const [saving, setSaving] = useState(false);

  const slots = useQuery({
    queryKey: ["slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_slots")
        .select("*")
        .eq("active", true)
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const specialDays = useSpecialDays();
  const suggestions = useMemo(() => {
    const special = (specialDays.data ?? []).find((s) => s.day === day);
    if (special && special.times.length > 0) return special.times.map((t) => shortTime(String(t)));
    return (slots.data ?? [])
      .filter((s) => s.weekday === weekdayOf(day))
      .map((s) => shortTime(s.start_time));
  }, [slots.data, specialDays.data, day]);

  async function save() {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      toast.error("Informe o horário no formato 00:00.");
      return;
    }
    setSaving(true);
    try {
      const result = await adminRescheduleFn({
        data: { appointmentId: appointment.id, day, startTime: time },
      });
      await queryClient.invalidateQueries();
      toast.success(
        result.calendar === "ok"
          ? "Horário realocado e Google Agenda atualizada."
          : "Horário realocado. Não foi possível atualizar a Google Agenda.",
      );
      const link = whatsappLinkTo(
        result.client.phone,
        rescheduleMessage({
          name: result.client.name,
          serviceName: result.serviceName,
          oldDay: result.oldDay,
          oldStart: result.oldStart,
          day: result.day,
          start: result.startTime,
          durationMinutes: result.durationMinutes,
        }),
      );
      if (link) window.open(link, "_blank", "noopener");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível realocar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarClock size={16} /> Reagendar / Realocar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reagendar / Realocar</DialogTitle>
          <DialogDescription>
            {appointment.clientName} · {appointment.serviceName} · atualmente{" "}
            {formatDayLabel(appointment.day)} às {shortTime(appointment.start_time)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-resched-day">Nova data</Label>
            <Input
              id="admin-resched-day"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-resched-time">Novo horário</Label>
            <Input
              id="admin-resched-time"
              value={time}
              maxLength={5}
              onChange={(e) => setTime(e.target.value)}
              placeholder="14:30"
            />
            {suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={time === t ? "default" : "outline"}
                    onClick={() => setTime(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Sem restrição de agenda: horários fora do expediente entram como Atendimento Especial
              ✨.
            </p>
          </div>
          <Button className="w-full" onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando..." : "Confirmar novo horário"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}