import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { localTodayISO } from "@/lib/salon";
import { buildMonthGrid, groupByDay, shiftMonth } from "@/lib/agenda-calendar";
import { ManualAppointmentDialog } from "./manual-appointment-dialog";

export interface CalendarAppointment {
  id: string;
  day: string;
  start_time: string;
  status: string;
  clientName: string;
  serviceName: string;
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const STATUS_STYLE: Record<string, string> = {
  confirmado: "bg-primary text-primary-foreground",
  pendente: "bg-accent text-accent-foreground border border-primary/40",
  concluido: "bg-muted text-muted-foreground",
};

function statusLabel(s: string): string {
  return s === "confirmado" ? "Confirmado" : s === "pendente" ? "Pré-agendamento" : s === "concluido" ? "Concluído" : s;
}

/** Visão mensal estilo Google Agenda: somente leitura + atalho de agendamento no dia. */
export function AgendaCalendarDialog({ appointments }: { appointments: CalendarAppointment[] }) {
  const today = localTodayISO();
  const ty = Number(today.slice(0, 4));
  const tm = Number(today.slice(5, 7));
  const [ym, setYm] = useState({ year: ty, month: tm });
  const [selected, setSelected] = useState<string | null>(null);
  const [bookDay, setBookDay] = useState<string | null>(null);

  const visible = useMemo(() => appointments.filter((a) => a.status !== "cancelado"), [appointments]);
  const byDay = useMemo(() => groupByDay(visible), [visible]);
  const grid = useMemo(() => buildMonthGrid(ym.year, ym.month), [ym]);
  const dayList = selected ? byDay.get(selected) ?? [] : [];

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <CalendarDays size={16} /> Google Agenda
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle>Agenda do mês</DialogTitle>
            <DialogDescription>Toque em um dia para ver as clientes em ordem de horário.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" aria-label="Mês anterior" onClick={() => setYm((v) => shiftMonth(v.year, v.month, -1))}>
                <ChevronLeft size={18} />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Próximo mês" onClick={() => setYm((v) => shiftMonth(v.year, v.month, 1))}>
                <ChevronRight size={18} />
              </Button>
              <h3 className="font-display text-lg">{MONTHS[ym.month - 1]} {ym.year}</h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setYm({ year: ty, month: tm }); setSelected(today); }}>
              Hoje
            </Button>
          </div>

          <div className="grid grid-cols-7 border-l border-t border-border text-xs">
            {WEEKDAYS.map((w, i) => (
              <div key={`wd-${i}`} className="border-b border-r border-border py-1 text-center font-medium text-muted-foreground">{w}</div>
            ))}
            {grid.map((cell) => {
              const items = byDay.get(cell.iso) ?? [];
              const isToday = cell.iso === today;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelected(cell.iso)}
                  className={cn(
                    "flex min-h-20 flex-col items-stretch gap-0.5 border-b border-r border-border p-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-24",
                    !cell.inMonth && "bg-muted/40",
                    selected === cell.iso && "bg-accent/60",
                  )}
                >
                  <span className={cn(
                    "mx-auto flex h-6 w-6 items-center justify-center rounded-full",
                    isToday ? "bg-primary font-semibold text-primary-foreground" : cell.inMonth ? "text-foreground" : "text-muted-foreground",
                  )}>{cell.day}</span>
                  {items.slice(0, 3).map((a) => (
                    <span key={a.id} className={cn("truncate rounded px-1 text-[10px] leading-4", STATUS_STYLE[a.status] ?? "bg-muted")}>
                      {a.start_time.slice(0, 5)} {a.clientName}
                    </span>
                  ))}
                  {items.length > 3 ? <span className="px-1 text-[10px] text-muted-foreground">+{items.length - 3}</span> : null}
                </button>
              );
            })}
          </div>

          {selected ? (
            <section className="space-y-2 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium">{selected.split("-").reverse().join("/")}</h4>
                {selected >= today ? (
                  <Button size="sm" onClick={() => setBookDay(selected)}>
                    <Plus size={14} /> Agendar neste dia
                  </Button>
                ) : null}
              </div>
              {dayList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum atendimento neste dia.</p>
              ) : (
                <ul className="space-y-1.5">
                  {dayList.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-md border border-border px-2 py-1.5 text-sm">
                      <span className="w-12 font-semibold text-primary">{a.start_time.slice(0, 5)}</span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{a.clientName}</span>
                        <span className="text-muted-foreground"> — {a.serviceName}</span>
                      </span>
                      <span className={cn("rounded-full px-2 text-[10px]", STATUS_STYLE[a.status] ?? "bg-muted")}>{statusLabel(a.status)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </DialogContent>
      </Dialog>

      {bookDay ? (
        <ManualAppointmentDialog
          key={bookDay}
          open
          hideTrigger
          initialDay={bookDay}
          onOpenChange={(v) => { if (!v) setBookDay(null); }}
        />
      ) : null}
    </>
  );
}
