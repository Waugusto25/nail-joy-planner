import { Check, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { scheduleCalendarMonths, scheduleCalendarYears } from "@/lib/schedule-month-calendar";

type Props = {
  currentMonth: string;
  year: number;
  activeMonths: ReadonlyMap<string, { active: boolean }>;
  savingMonth: string | null;
  disabled: boolean;
  onYearChange: (year: number) => void;
  onToggle: (key: string, active: boolean) => void;
};

export function ScheduleMonthCalendar({ currentMonth, year, activeMonths, savingMonth, disabled, onYearChange, onToggle }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg">Meses da agenda</h3>
        <div className="flex gap-1" role="group" aria-label="Ano da agenda">
          {scheduleCalendarYears(currentMonth).map((option) => (
            <Button key={option} type="button" variant={year === option ? "default" : "outline"}
              aria-pressed={year === option} onClick={() => onYearChange(option)}>{option}</Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3" role="group" aria-label={`Meses de ${year}`}>
        {scheduleCalendarMonths(year, currentMonth).map(({ key, name, past }) => {
          // A missing row has always meant active; preserve existing availability.
          const active = activeMonths.get(key)?.active ?? true;
          const saving = savingMonth === key;
          return (
            <Button key={key} type="button" variant="outline" aria-pressed={!past && active}
              aria-label={`${name} ${year}: ${past ? "Passado" : active ? "Ligado" : "Desligado"}`}
              disabled={past || disabled || savingMonth !== null}
              onClick={() => onToggle(key, !active)}
              className={cn("h-24 min-w-0 flex-col gap-1 rounded-lg px-1 shadow-none disabled:opacity-100",
                past ? "border-border bg-muted text-muted-foreground" : active
                  ? "border-schedule-enabled bg-schedule-enabled text-schedule-enabled-foreground hover:bg-schedule-enabled/90 hover:text-schedule-enabled-foreground"
                  : "bg-card text-card-foreground")}
            >
              <span className="text-sm font-semibold">{name}</span>
              <span className="flex h-5 items-center gap-1 text-xs font-normal">
                {saving ? <Loader2 className="size-3 animate-spin" /> : past ? <Lock className="size-3" /> : active ? <Check className="size-3" /> : null}
                {saving ? "Salvando" : past ? "Passado" : active ? "Ligado" : "Desligado"}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}