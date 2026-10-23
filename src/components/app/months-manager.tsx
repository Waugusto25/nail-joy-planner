import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase-client";
import { useAppSettings } from "@/hooks/useSettings";
import { useScheduleMonths } from "@/hooks/useScheduleMonths";
import { monthLabel } from "@/lib/months";
import { ScheduleMonthCalendar } from "./schedule-month-calendar";
import { canChangeScheduleMonth, scheduleCalendarMonths, scheduleCalendarYears, scheduleCurrentMonth } from "@/lib/schedule-month-calendar";

/** Gerenciamento de meses ativos, recados de recesso e antecedência máxima. */
export function MonthsManager() {
  const queryClient = useQueryClient();
  const months = useScheduleMonths();
  const settings = useAppSettings();
  const [advance, setAdvance] = useState("2");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [currentMonth, setCurrentMonth] = useState(() => scheduleCurrentMonth());
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [savingMonth, setSavingMonth] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setCurrentMonth(scheduleCurrentMonth());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    refresh();
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);

  useEffect(() => {
    if (settings.data) setAdvance(String(settings.data.max_advance_months));
  }, [settings.data?.max_advance_months]);

  const years = scheduleCalendarYears(currentMonth);
  const year = selectedYear !== null && years.includes(selectedYear) ? selectedYear : years[0];
  const byMonth = useMemo(
    () => new Map((months.data ?? []).map((m) => [m.month, m])),
    [months.data],
  );

  async function saveMonth(month: string, patch: { active?: boolean; message?: string | null }) {
    if (savingMonth || !canChangeScheduleMonth(month, currentMonth)) return;
    const current = byMonth.get(month);
    const row = {
      month,
      active: patch.active ?? current?.active ?? true,
      message: patch.message !== undefined ? patch.message : (current?.message ?? null),
    };
    setSavingMonth(month);
    try {
      const { error } = await supabase.from("schedule_months").upsert(row, { onConflict: "month" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["schedule-months"] });
    } catch {
      toast.error("Não foi possível salvar esse mês.");
    } finally {
      setSavingMonth(null);
    }
  }

  async function saveAdvance() {
    const value = Math.min(12, Math.max(0, Number(advance) || 0));
    const { error } = await supabase
      .from("app_settings")
      .update({ max_advance_months: value })
      .eq("id", true);
    if (error) {
      toast.error("Não foi possível salvar a antecedência.");
      return;
    }
    toast.success("Antecedência atualizada.");
    await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
  }

  return (
    <section className="surface-card space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg">Gerenciamento de meses e disponibilidade</h2>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-muted/40 p-3">
        <div className="space-y-1">
          <Label htmlFor="advance-months">Antecedência máxima (meses)</Label>
          <Input
            id="advance-months"
            type="number"
            min={0}
            max={12}
            className="w-28"
            value={advance}
            onChange={(e) => setAdvance(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => void saveAdvance()}>
          Salvar antecedência
        </Button>
        <p className="text-xs text-muted-foreground">
          As clientes só veem o mês atual e os próximos {advance || 0} meses.
        </p>
      </div>

      {months.isPending ? <p role="status" className="text-sm text-muted-foreground">Carregando meses…</p> : null}
      {months.isError ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        Não foi possível carregar os meses.
        <Button variant="outline" onClick={() => void months.refetch()}>Tentar novamente</Button>
      </div> : null}
      <ScheduleMonthCalendar currentMonth={currentMonth} year={year} activeMonths={byMonth}
        savingMonth={savingMonth} disabled={months.isPending || months.isError}
        onYearChange={setSelectedYear} onToggle={(key, active) => void saveMonth(key, { active })} />
      <details className="border-t border-border pt-3">
        <summary className="cursor-pointer text-sm font-medium">Recados de férias / recesso</summary>
        <ul className="mt-3 space-y-3">
        {scheduleCalendarMonths(year, currentMonth).filter(({ key, past }) => !past && byMonth.get(key)?.active === false).map(({ key }) => {
          const row = byMonth.get(key);
          const message = drafts[key] ?? row?.message ?? "";
          return (
            <li key={key} className="rounded-lg border border-border p-3">
              <span className="font-medium">{monthLabel(key)}</span>
                <div className="mt-3 space-y-2">
                  <Label htmlFor={`msg-${key}`} className="text-xs">
                    Recado de férias / recesso
                  </Label>
                  <Textarea
                    id={`msg-${key}`}
                    rows={2}
                    maxLength={200}
                    value={message}
                    placeholder="Estaremos em recesso de 01/01 a 15/01. Voltamos em breve!"
                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={savingMonth !== null || months.isPending || months.isError}
                    onClick={() => void saveMonth(key, { message: message.trim() || null })}
                  >
                    Salvar recado
                  </Button>
                </div>
            </li>
          );
        })}
      </ul>
      </details>
    </section>
  );
}
