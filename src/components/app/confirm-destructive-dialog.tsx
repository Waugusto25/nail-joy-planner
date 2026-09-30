import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type ConfirmTone = "destructive" | "warning";

export type ConfirmDestructiveOptions = {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /**
   * Trabalho assíncrono opcional. Quando informado, o modal permanece aberto
   * exibindo o indicador de carregamento até a promessa resolver — impedindo
   * clique duplo e fechamento acidental no meio da operação.
   */
  action?: () => Promise<void> | void;
};

type PendingRequest = ConfirmDestructiveOptions & {
  resolve: (confirmed: boolean) => void;
};

type Listener = (request: PendingRequest) => void;

let listener: Listener | null = null;

/**
 * Abre o aviso padrão de exclusão e resolve `true` somente após a confirmação
 * explícita da pessoa. Sem host montado, resolve `false` (nada é apagado).
 */
export function confirmDestructive(options: ConfirmDestructiveOptions): Promise<boolean> {
  if (!listener) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    listener?.({ ...options, resolve });
  });
}

/** Monte uma única vez na raiz do app. */
export function ConfirmDestructiveHost() {
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listener = (next) => {
      setBusy(false);
      setRequest(next);
    };
    return () => {
      listener = null;
    };
  }, []);

  function close(confirmed: boolean) {
    request?.resolve(confirmed);
    setRequest(null);
    setBusy(false);
  }

  async function confirm() {
    if (!request || busy) return;
    if (!request.action) {
      close(true);
      return;
    }
    setBusy(true);
    try {
      await request.action();
      close(true);
    } catch {
      close(false);
    }
  }

  const tone: ConfirmTone = request?.tone ?? "destructive";

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && !busy) close(false);
      }}
    >
      {request ? (
        <AlertDialogContent
          className="surface-card max-w-md"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <div className="flex items-start gap-3 text-left">
              <span
                className={cn(
                  "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  tone === "destructive"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary",
                )}
                aria-hidden
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="space-y-2">
                <AlertDialogTitle className="font-display text-lg leading-tight">
                  {request.title}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-relaxed">
                  {request.description}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={busy}>
              {request.cancelLabel ?? "Voltar"}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void confirm();
              }}
              className={cn(
                tone === "destructive" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              {request.confirmLabel ?? "Sim, excluir permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
