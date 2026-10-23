import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppSettings } from "@/hooks/useSettings";
import { manualScheduleFn } from "@/lib/manual-booking.functions";
import { manualAvailableTimes, manualTimeConflict, manualWeekday } from "@/lib/manual-availability";
import { currentMonthKey, daysUntilEndOfMonth, monthKeysFrom, monthShortLabel } from "@/lib/months";
import { BOOKING_LEAD_MINUTES, WEEKDAYS, currentMinutes, localTodayISO } from "@/lib/salon";

type Props = {
  day: string; time: string; duration: number; special: boolean;
  onChange: (day: string, time: string) => void;
  onSpecialChange: (special: boolean) => void;
  onValidityChange: (valid: boolean) => void;
};

export function ManualSchedulePicker({ day, time, duration, special, onChange, onSpecialChange }: Props) {
  const settings = useAppSettings();
  const [month, setMonth] = useState(currentMonthKey);
  const fetchSchedule = useServerFn(manualScheduleFn);
  const schedule = useQuery({
    queryKey: ["manual-schedule", special ? day.slice(0, 7) : month],
    queryFn: () => fetchSchedule({ data: { month: special ? day.slice(0, 7) : month } }),
    refetchInterval: 30000,
  });
  const today = localTodayISO();
  const minStart = currentMinutes() + BOOKING_LEAD_MINUTES;
  const times = (date: string) => schedule.data ? manualAvailableTimes(schedule.data, date, duration, today, minStart) : [];
  const days = daysUntilEndOfMonth(today > `${month}-01` ? today : `${month}-01`, month).filter((date) => times(date).length > 0);
  const conflict = Boolean(time && schedule.data && manualTimeConflict(schedule.data, day, time, duration));

  return <section className="space-y-3" aria-label="Data e horário do atendimento">
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant={!special ? "default" : "outline"} onClick={() => { onSpecialChange(false); onChange(`${month}-01`, ""); }}>Horários disponíveis</Button>
      <Button size="sm" variant={special ? "default" : "outline"} onClick={() => { onSpecialChange(true); onChange(day, ""); }}><Sparkles size={16} /> Atendimento especial</Button>
      <Button size="icon" variant="ghost" aria-label="Atualizar horários" onClick={() => { onChange(day, ""); void schedule.refetch(); }}><RefreshCw size={16} /></Button>
    </div>
    {special ? <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1"><Label htmlFor="manual-dia">Data especial</Label><Input id="manual-dia" type="date" value={day} onChange={(e) => { if (e.target.value) onChange(e.target.value, ""); }} /></div>
      <div className="space-y-1"><Label htmlFor="manual-hora">Horário especial</Label><Input id="manual-hora" type="time" value={time} onChange={(e) => onChange(day, e.target.value)} /></div>
    </div> : <>
      <Label>Escolha a data</Label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {monthKeysFrom((settings.data?.max_advance_months ?? 2) + 1).map((key) => <Button key={key} size="sm" className="shrink-0" variant={key === month ? "default" : "outline"} onClick={() => { setMonth(key); onChange(`${key}-01`, ""); }}>{monthShortLabel(key)}</Button>)}
      </div>
      {!schedule.isPending && !schedule.isError ? <div className="flex flex-wrap gap-2">
        {days.map((date) => <Button key={date} size="sm" variant={day === date ? "default" : "outline"} onClick={() => onChange(date, "")}>
          {date.slice(8)}/{date.slice(5, 7)} · {WEEKDAYS[manualWeekday(date)]?.slice(0, 3)}{schedule.data?.special.some((s) => s.day === date && s.times.length > 0) ? " ✨" : ""}
        </Button>)}
        {days.length === 0 ? <p className="text-sm text-muted-foreground">{schedule.data?.monthActive === false ? "Agendamentos deste mês estão fechados." : "Nenhuma vaga disponível para este procedimento neste mês."}</p> : null}
      </div> : null}
      <Label>Escolha o horário</Label>
      <div className="flex flex-wrap gap-2">
        {!schedule.isPending && times(day).map((slot) => <Button key={slot} size="sm" variant={time === slot ? "default" : "outline"} onClick={() => onChange(day, slot)}>{slot}</Button>)}
      </div>
    </>}
    {schedule.isFetching ? <p role="status" className="text-sm text-muted-foreground">Consultando horários...</p> : null}
    {schedule.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível consultar a agenda. <Button size="sm" variant="outline" onClick={() => void schedule.refetch()}>Tentar novamente</Button></p> : null}
    {conflict ? <p role="alert" className="text-sm text-destructive">Este horário está ocupado ou o procedimento ultrapassa a meia-noite. Escolha outro horário.</p> : null}
    {special ? <p className="text-xs text-primary">Atendimento Especial ✨ — fora da grade comum, sem alterar o expediente semanal.</p> : null}
  </section>;
}