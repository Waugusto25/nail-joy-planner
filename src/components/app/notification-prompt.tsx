import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { usePush } from "@/components/app/push-toggle";

const STORAGE_KEY = "hasSeenNotificationPrompt";

/** Pop-up de primeiro acesso pedindo permissão de notificações (aparece só uma vez). */
export function NotificationPrompt({ active = true }: { active?: boolean }) {
  const { supported, enabled, busy, enable } = usePush();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!active || !supported) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "true") return;
    if (enabled) {
      window.localStorage.setItem(STORAGE_KEY, "true");
      return;
    }
    setOpen(true);
  }, [active, supported, enabled]);

  function dismiss() {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : dismiss())}>
      <DialogContent className="max-w-sm text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
          <Bell className="text-primary" size={26} />
        </div>
        <h2 className="font-display text-lg text-foreground">
          Fique por dentro dos seus agendamentos! 🔔
        </h2>
        <p className="text-sm text-muted-foreground">
          Ative as notificações para receber confirmações, lembretes de horários e avisos sobre seus
          agendamentos em tempo real.
        </p>
        <div className="space-y-2 pt-1">
          <Button
            className="w-full"
            disabled={busy}
            onClick={async () => {
              await enable();
              dismiss();
            }}
          >
            Ativar Notificações
          </Button>
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={dismiss}>
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
