import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "jannah-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (window.self !== window.top) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
    if (isIos) {
      setIosHint(true);
      setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") window.localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md">
      <div className="surface-card flex items-start gap-3 p-4 shadow-lg">
        <img src="/icon-192.png" alt="Jannah Nails" className="h-11 w-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold">Instalar o Jannah Nails</p>
          {iosHint && !deferred ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Toque em <Share className="inline h-3 w-3" /> Compartilhar e escolha “Adicionar à Tela
              de Início”.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Adicione à tela inicial e abra em tela cheia, como um aplicativo.
            </p>
          )}
          {deferred ? (
            <Button size="sm" className="mt-3" onClick={install}>
              <Download className="mr-1 h-4 w-4" /> Instalar
            </Button>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Fechar aviso de instalação"
          onClick={dismiss}
          className="text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}