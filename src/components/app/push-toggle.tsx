import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VAPID_PUBLIC_KEY } from "@/lib/push-schemas";
import {
  removePushSubscriptionFn,
  savePushSubscriptionFn,
  sendTestPushFn,
} from "@/lib/push.functions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function keyToBase64(buffer: ArrayBuffer | null) {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type Props = { audience: "admin" | "cliente" };

/** Estado e ações das notificações push neste dispositivo. */
function usePush() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
      return;
    setSupported(true);
    navigator.serviceWorker
      .register("/push-sw.js", { scope: "/" })
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setEnabled(Boolean(subscription)))
      .catch(() => setSupported(false));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Permissão de notificação negada nas configurações do navegador.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));

      await savePushSubscriptionFn({
        data: {
          endpoint: subscription.endpoint,
          p256dh: keyToBase64(subscription.getKey("p256dh")),
          auth: keyToBase64(subscription.getKey("auth")),
          userAgent: navigator.userAgent.slice(0, 400),
        },
      });
      setEnabled(true);
      await sendTestPushFn();
      toast.success("Notificações ativadas neste aparelho.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível ativar as notificações aqui.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscriptionFn({ data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setEnabled(false);
      toast.success("Notificações desativadas neste aparelho.");
    } catch {
      toast.error("Não foi possível desativar agora.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;
  return { supported, enabled, busy, enable, disable };
}

function describe(audience: Props["audience"], enabled: boolean) {
  return enabled
    ? audience === "admin"
      ? "Você recebe um alerta na tela de bloqueio a cada novo pré-agendamento."
      : "Você recebe um lembrete 24h antes do seu atendimento."
    : audience === "admin"
      ? "Ative para ser avisada na hora em que uma cliente fizer um pré-agendamento."
      : "Ative para receber o lembrete automático 24h antes do seu horário.";
}

/** Sininho discreto no cabeçalho, com popover para ativar/desativar. */
export function PushBell({ audience }: Props) {
  const push = usePush();
  if (!push.supported) return null;
  const { enabled, busy, enable, disable } = push;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full"
          aria-label={enabled ? "Notificações ativadas" : "Notificações desativadas"}
        >
          {enabled ? (
            <Bell className="text-primary" size={18} />
          ) : (
            <BellOff className="text-muted-foreground" size={18} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Notificações no celular</p>
          <p className="text-xs text-muted-foreground">{describe(audience, enabled)}</p>
        </div>
        <Button
          size="sm"
          className="w-full"
          variant={enabled ? "outline" : "default"}
          disabled={busy}
          onClick={enabled ? disable : enable}
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : enabled ? "Desativar" : "Ativar"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** Liga/desliga as notificações push neste dispositivo (cartão completo). */
export function PushToggle({ audience }: Props) {
  const push = usePush();
  if (!push.supported) return null;
  const { enabled, busy, enable, disable } = push;
  const description = describe(audience, enabled);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {enabled ? (
          <Bell className="mt-0.5 shrink-0 text-primary" size={18} />
        ) : (
          <BellOff className="mt-0.5 shrink-0 text-muted-foreground" size={18} />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">Notificações no celular</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button
        size="sm"
        variant={enabled ? "outline" : "default"}
        disabled={busy}
        onClick={enabled ? disable : enable}
      >
        {busy ? <Loader2 className="animate-spin" size={16} /> : enabled ? "Desativar" : "Ativar"}
      </Button>
    </div>
  );
}
