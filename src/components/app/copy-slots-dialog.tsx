import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase-client";
import { WEEKDAYS } from "@/lib/salon";
import { planSlotCopy, type SlotCopyMode, type SlotRow } from "@/lib/slot-copy";
import { cn } from "@/lib/utils";

interface Props {
  readonly sourceDay: number | null;
  readonly rows: readonly SlotRow[];
  readonly onClose: () => void;
  readonly onDone: () => Promise<void>;
}

// Monday-first order to match the rest of the Horários tab.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function CopySlotsDialog({ sourceDay, rows, onClose, onDone }: Props) {
  const [targets, setTargets] = useState<number[]>([]);
  const [mode, setMode] = useState<SlotCopyMode>("replace");
  const [saving, setSaving] = useState(false);
  const open = sourceDay !== null;
  const others = ORDER.filter((d) => d !== sourceDay);
  const sourceTimes = rows
    .filter((r) => r.weekday === sourceDay)
    .map((r) => r.start_time.slice(0, 5))
    .sort();
  const allSelected = targets.length === others.length;

  function close() {
    setTargets([]);
    setMode("replace");
    onClose();
  }

  async function confirm() {
    if (sourceDay === null || targets.length === 0) {
      toast.error("Selecione ao menos um dia.");
      return;
    }
    setSaving(true);
    const plan = planSlotCopy(rows, sourceDay, targets, mode);
    // Insert first so a failure never leaves a target day empty.
    if (plan.inserts.length > 0) {
      const { error } = await supabase.from("schedule_slots").insert(plan.inserts);
      if (error) {
        setSaving(false);
        toast.error("Não foi possível copiar os horários.");
        return;
      }
    }
    if (plan.deleteIds.length > 0) {
      const { error } = await supabase.from("schedule_slots").delete().in("id", plan.deleteIds);
      if (error) toast.error("Alguns horários antigos não puderam ser removidos.");
    }
    await onDone();
    setSaving(false);
    toast.success(`Horários copiados para ${targets.length} dia(s).`);
    close();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Copiar horários de {sourceDay !== null ? WEEKDAYS[sourceDay] : ""}</DialogTitle>
          <DialogDescription>{sourceTimes.join(", ")}</DialogDescription>
        </DialogHeader>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setTargets(allSelected ? [] : others)}
        >
          {allSelected ? "Desmarcar todos" : "Selecionar todos os dias"}
        </Button>
        <ul className="grid grid-cols-2 gap-2">
          {others.map((d) => {
            const count = rows.filter((r) => r.weekday === d).length;
            const id = `copy-day-${d}`;
            return (
              <li key={d} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={id}
                  checked={targets.includes(d)}
                  onCheckedChange={(c) =>
                    setTargets((prev) => (c ? [...prev, d] : prev.filter((x) => x !== d)))
                  }
                />
                <label htmlFor={id} className="cursor-pointer">
                  {WEEKDAYS[d]} <span className="text-xs text-muted-foreground">({count})</span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-xs" role="radiogroup">
          {(["replace", "merge"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {m === "replace" ? "Substituir" : "Mesclar"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "replace"
            ? "Os dias marcados ficam com exatamente os mesmos horários."
            : "Mantém os horários atuais e adiciona os que faltam."}
        </p>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>Cancelar</Button>
          <Button type="button" onClick={() => void confirm()} disabled={saving || targets.length === 0}>
            {saving ? "Copiando..." : "Copiar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
