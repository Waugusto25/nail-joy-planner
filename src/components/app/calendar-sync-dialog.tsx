import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dismissCalendarPromptFn, setMyCalendarEmailFn } from "@/lib/account.functions";

/**
 * Pop-up exibido no acesso da cliente convidando a cadastrar o e-mail do Gmail
 * para sincronizar os agendamentos na Google Agenda dela.
 */
export function CalendarSyncDialog({ open, onDone }: { open: boolean; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [dismiss, setDismiss] = useState(false);
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    try {
      if (email.trim()) {
        await setMyCalendarEmailFn({ data: { email } });
        toast.success("E-mail salvo! Seus agendamentos vão aparecer na sua Google Agenda. 📅");
        onDone();
        return;
      }
      if (dismiss) {
        await dismissCalendarPromptFn();
        toast.info(
          "Você pode adicionar seu e-mail a qualquer momento clicando no ícone de Engrenagem (⚙️) no canto superior do painel.",
        );
      }
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onDone())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fique por dentro da sua AGENDA! 📅</DialogTitle>
          <DialogDescription>
            Adicione seu e-mail do Gmail para sincronizar seus agendamentos diretamente na sua Google
            Agenda em tempo real!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="calendar-email">E-mail do Gmail (opcional)</Label>
            <Input
              id="calendar-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@gmail.com"
            />
            <p className="text-xs text-muted-foreground">
              Depois de salvo, o e-mail fica fixo: para trocar é preciso pedir a aprovação da
              Janaina nas configurações.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={dismiss}
              onCheckedChange={(v) => setDismiss(v === true)}
              aria-label="Não mostrar esta mensagem nos próximos acessos"
            />
            <span>Não mostrar esta mensagem nos próximos acessos</span>
          </label>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void confirm()} disabled={saving}>
              {saving ? "Salvando..." : email.trim() ? "Salvar e continuar" : "Continuar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
