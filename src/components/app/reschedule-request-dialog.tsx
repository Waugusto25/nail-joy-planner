import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase-client";
import { useSpecialDays } from "@/hooks/useSpecialDays";
import { busyTimesFn } from "@/lib/booking.functions";
import { requestRescheduleFn } from "@/lib/reschedule.functions";
import {
  RESCHEDULE_MIN_HOURS,
  adminRescheduleRequestAlert,
  formatDayLabel,
  hoursUntilAppointment,
  overlaps,
  shortTime,
  timeToMinutes,
  whatsappLink,
} from "@/lib/salon";

function isoPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).getDay();
}

/**
 * Fluxo da cliente: escolhe uma nova data livre, um horário livre e informa
 * obrigatoriamente a justificativa antes de enviar o pedido para a Janaina.
 */
export function RescheduleRequestDialog({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: {
    id: string;
    day: string;
    start_time: string;
    serviceName: string;
    durationMinutes: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [reason, setReason] = useState("");
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

  const breaks = useQuery({
    queryKey: ["breaks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_breaks")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  const blocked = useQuery({
    queryKey: ["blocked"],
    queryFn: async () => {
      const { data, error } = await supabase.from("blocked_dates").select("day");
      if (error) throw error;
      return (data ?? []).map((r) => r.day);
    },
  });

  const busy = useQuery({
    queryKey: ["busy", day],
    enabled: Boolean(day),
    queryFn: async () => (await busyTimesFn({ data: { day: day! } })).busy,
  });

  const specialDays = useSpecialDays();
  const specialByDay = useMemo(
    () => new Map((specialDays.data ?? []).filter((s) => s.times.length > 0).map((s) => [s.day, s])),
    [specialDays.data],
  );

  // Datas livres a partir de amanhã, dentro dos próximos 90 dias.
  const availableDays = useMemo(() => {
    const weekdaysWithSlots = new Set((slots.data ?? []).map((s) => s.weekday));
    const blockedSet = new Set(blocked.data ?? []);
    const list: string[] = [];
    for (let i = 1; i <= 90; i += 1) {
      const d = isoPlusDays(i);
      if (specialByDay.has(d) || (weekdaysWithSlots.has(weekdayOf(d)) && !blockedSet.has(d))) {
        list.push(d);
      }
    }
    return list;
  }, [slots.data, blocked.data, specialByDay]);

  const dayTimes = useMemo(() => {
    if (!day) return [];
    const weekday = weekdayOf(day);
    const duration = appointment.durationMinutes;
    const busyRanges = (busy.data ?? []).map((b) => ({
      start: timeToMinutes(b.start),
      end: timeToMinutes(b.start) + b.duration,
    }));
    const special = specialByDay.get(day);
    const breakRanges = special
      ? []
      : (breaks.data ?? [])
          .filter((b) => b.weekday === weekday)
          .map((b) => ({ start: timeToMinutes(b.start_time), end: timeToMinutes(b.end_time) }));
    const baseTimes = special
      ? special.times.map((t) => shortTime(String(t)))
      : (slots.data ?? []).filter((s) => s.weekday === weekday).map((s) => shortTime(s.start_time));
    return baseTimes
      .filter((t) => {
        const start = timeToMinutes(t);
        const end = start + duration;
        if (end > 24 * 60) return false;
        if (busyRanges.some((r) => overlaps(start, end, r.start, r.end))) return false;
        if (breakRanges.some((r) => overlaps(start, end, r.start, r.end))) return false;
        return true;
      })
      .sort();
  }, [day, appointment.durationMinutes, busy.data, breaks.data, slots.data, specialByDay]);

  async function send() {
    if (!day || !time || reason.trim().length < 5) return;
    setSaving(true);
    try {
      const result = await requestRescheduleFn({
        data: { appointmentId: appointment.id, day, startTime: time, reason: reason.trim() },
      });
      await queryClient.invalidateQueries();
      toast.success(
        "Pedido enviado! A Janaina vai avaliar a nova data e você recebe o aviso da aprovação. 💖",
        { duration: 9000 },
      );
      const message = adminRescheduleRequestAlert({
        name: result.clientName,
        serviceName: result.serviceName,
        oldDay: result.oldDay,
        oldStart: result.oldStart,
        newDay: result.day,
        newStart: result.startTime,
        reason: result.reason,
      });
      window.open(whatsappLink(message), "_blank", "noopener");
      onOpenChange(false);
      setDay(null);
      setTime(null);
      setReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o pedido.");
    } finally {
      setSaving(false);
    }
  }

  const stillAllowed = hoursUntilAppointment(appointment.day, appointment.start_time) > RESCHEDULE_MIN_HOURS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitar alteração de data/horário</DialogTitle>
          <DialogDescription>
            {appointment.serviceName} · atualmente {formatDayLabel(appointment.day)} às{" "}
            {shortTime(appointment.start_time)}
          </DialogDescription>
        </DialogHeader>
        {!stillAllowed ? (
          <p className="text-sm font-semibold text-destructive">
            Alterações pelo app são permitidas apenas com até 72h de antecedência. Entre em contato
            direto pelo WhatsApp.
          </p>
        ) : (
          <div className="space-y-5">
            <section className="space-y-2">
              <Label>1. Escolha a nova data</Label>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {availableDays.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`capitalize ${day === d ? "chip-active" : "chip"}`}
                    onClick={() => {
                      setDay(d);
                      setTime(null);
                    }}
                  >
                    {formatDayLabel(d)}
                  </button>
                ))}
              </div>
            </section>

            {day ? (
              <section className="space-y-2">
                <Label>2. Escolha o novo horário</Label>
                {dayTimes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum horário livre nesta data. Escolha outro dia.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {dayTimes.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={time === t ? "chip-active" : "chip"}
                        onClick={() => setTime(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {day && time ? (
              <section className="space-y-2">
                <Label htmlFor="reschedule-reason">
                  3. Por favor, informe o motivo pelo qual precisa alterar o seu horário:
                </Label>
                <Textarea
                  id="reschedule-reason"
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Conte rapidinho o motivo da alteração"
                />
                <Button
                  className="w-full"
                  onClick={() => void send()}
                  disabled={saving || reason.trim().length < 5}
                >
                  {saving ? "Enviando..." : "Enviar pedido de alteração"}
                </Button>
              </section>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}