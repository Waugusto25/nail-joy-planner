import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Info, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/lib/supabase-client";
import { useSpecialDays } from "@/hooks/useSpecialDays";
import { formatDayLabel, localTodayISO } from "@/lib/salon";
import { groupUpcomingByMonth, isPastDay } from "@/lib/special-days-grouping";
import { cn } from "@/lib/utils";
import { confirmDestructive } from "@/components/app/confirm-destructive-dialog";

/** Cadastro de dias especiais: data única, horários exclusivos e motivo. */
export function SpecialDaysManager() {
  const queryClient = useQueryClient();
  const specialDays = useSpecialDays({ includeInactive: true });
  const [open, setOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const [time, setTime] = useState("09:00");
  const [times, setTimes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function addTime() {
    if (!time) return;
    setTimes((list) => (list.includes(time) ? list : [...list, time].sort()));
  }

  function reset() {
    setDay("");
    setReason("");
    setTimes([]);
    setTime("09:00");
  }

  async function save() {
    if (!day) {
      toast.error("Escolha a data do dia especial.");
      return;
    }
    if (times.length === 0) {
      toast.error("Adicione pelo menos um horário para esse dia.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("special_days").upsert(
      {
        day,
        reason: reason.trim() || null,
        times: times.map((t) => `${t}:00`),
        active: true,
      },
      { onConflict: "day" },
    );
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar esse dia especial.");
      return;
    }
    toast.success("Dia especial cadastrado.");
    reset();
    setOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["special-days"] });
  }

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("special_days").update({ active }).eq("id", id);
    if (error) {
      toast.error("Não foi possível atualizar esse dia especial.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["special-days"] });
  }

  async function remove(id: string, label?: string) {
    const ok = await confirmDestructive({
      title: "Remover dia especial?",
      description: `A configuração especial${label ? ` de ${label}` : ""} será apagada. Esse dia volta a seguir os horários normais da semana.`,
      confirmLabel: "Remover configuração",
    });
    if (!ok) return;
    const { error } = await supabase.from("special_days").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover esse dia especial.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["special-days"] });
  }

  const rows = specialDays.data ?? [];
  const today = localTodayISO();
  const groups = groupUpcomingByMonth(rows, today);
  const upcoming = groups.flatMap((g) => g.rows);
  const pastIds = rows.filter((r) => isPastDay(r.day, today)).map((r) => r.id).join(",");

  // Datas concluídas saem sozinhas: apaga do banco as que já passaram (não afetam a agenda futura).
  useEffect(() => {
    if (!pastIds) return;
    void supabase
      .from("special_days")
      .delete()
      .in("id", pastIds.split(","))
      .then(({ error }) => {
        if (!error) void queryClient.invalidateQueries({ queryKey: ["special-days"] });
      });
  }, [pastIds, queryClient]);

  return (
    <section className="surface-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display flex items-center gap-2 text-lg">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            Dias especiais de atendimento
            <Popover>
              <PopoverTrigger
                aria-label="Sobre dias especiais"
                className="rounded-full text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Info className="h-4 w-4" aria-hidden />
              </PopoverTrigger>
              <PopoverContent className="text-sm">
                Abre uma data específica com horários exclusivos — sem mexer na agenda semanal e sem
                repetir nas semanas seguintes. Tem prioridade até sobre folgas e datas bloqueadas.
              </PopoverContent>
            </Popover>
          </h2>
        </div>
        <Button variant={open ? "outline" : "default"} onClick={() => setOpen((v) => !v)}>
          {open ? "Fechar" : "+ Cadastrar Dia Especial"}
        </Button>
      </div>

      {open ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="special-day">Data</Label>
              <Input
                id="special-day"
                type="date"
                min={localTodayISO()}
                className="w-44"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="special-time">Horário</Label>
              <div className="flex gap-2">
                <Input
                  id="special-time"
                  type="time"
                  className="w-32"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
                <Button variant="outline" onClick={addTime}>
                  Adicionar
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="special-reason">Descrição / motivo (opcional)</Label>
            <Input
              id="special-reason"
              maxLength={80}
              placeholder="Abertura Especial Dia das Mães"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {times.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {times.map((t) => (
                <li key={t}>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-sm"
                    onClick={() => setTimes((list) => list.filter((x) => x !== t))}
                    aria-label={`Remover horário ${t}`}
                  >
                    {t}
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhum horário adicionado ainda para essa data.
            </p>
          )}

          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando..." : "Salvar dia especial"}
          </Button>
        </div>
      ) : null}

      <Collapsible open={listOpen} onOpenChange={setListOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span>Dias especiais cadastrados ({upcoming.length})</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", listOpen && "rotate-180")} aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dia especial futuro cadastrado.</p>
          ) : null}
          {groups.map((group) => (
            <Collapsible key={group.month}>
              <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span>
                  {group.label} · {group.rows.length} {group.rows.length === 1 ? "data" : "datas"}
                </span>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="mt-2 space-y-2">
                  {group.rows.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div>
                        <p className="font-medium capitalize">{formatDayLabel(row.day)}</p>
                        {row.reason ? (
                          <p className="text-xs text-muted-foreground">{row.reason}</p>
                        ) : null}
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.times.length > 0 ? row.times.join(" · ") : "Sem horários"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.active}
                          aria-label={`Ativar dia especial ${row.day}`}
                          onCheckedChange={(checked) => void toggle(row.id, checked)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover dia especial"
                          onClick={() => void remove(row.id, formatDayLabel(row.day))}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}