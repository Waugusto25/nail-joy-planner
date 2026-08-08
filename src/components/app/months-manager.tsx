import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "@/hooks/useSettings";
import { useScheduleMonths } from "@/hooks/useScheduleMonths";
import { monthKeysFrom, monthLabel } from "@/lib/months";

/** Gerenciamento de meses ativos, recados de recesso e antecedência máxima. */
export function MonthsManager() {
  const queryClient = useQueryClient();
  const months = useScheduleMonths();
  const settings = useAppSettings();
  const [advance, setAdvance] = useState("2");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings.data) setAdvance(String(settings.data.max_advance_months));
  }, [settings.data?.max_advance_months]);

  // Mostra o mês atual e os próximos 11, cobrindo o ano vigente e o seguinte.
  const keys = useMemo(() => monthKeysFrom(12), []);
  const byMonth = useMemo(
    () => new Map((months.data ?? []).map((m) => [m.month, m])),
    [months.data],
  );

  async function saveMonth(month: string, patch: { active?: boolean; message?: string | null }) {
    const current = byMonth.get(month);
    const row = {
      month,
      active: patch.active ?? current?.active ?? true,
      message: patch.message !== undefined ? patch.message : (current?.message ?? null),
    };
    const { error } = await supabase.from("schedule_months").upsert(row, { onConflict: "month" });
    if (error) {
      toast.error("Não foi possível salvar esse mês.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["schedule-months"] });
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
        <p className="text-sm text-muted-foreground">
          Desligue um mês para bloquear novos agendamentos nele (férias, reforma) e deixe um recado
          para as clientes. As folgas por dia da semana e as datas bloqueadas continuam valendo.
        </p>
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

      <ul className="space-y-3">
        {keys.map((key) => {
          const row = byMonth.get(key);
          const active = row?.active ?? true;
          const message = drafts[key] ?? row?.message ?? "";
          return (
            <li key={key} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{monthLabel(key)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {active ? "Atendendo" : "Fechado"}
                  </span>
                  <Switch
                    checked={active}
                    aria-label={`Atendimento em ${monthLabel(key)}`}
                    onCheckedChange={(checked) => void saveMonth(key, { active: checked })}
                  />
                </div>
              </div>
              {!active ? (
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
                    onClick={() => void saveMonth(key, { message: message.trim() || null })}
                  >
                    Salvar recado
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
