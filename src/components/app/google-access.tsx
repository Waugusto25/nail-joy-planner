import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PasswordInput } from "@/components/app/password-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSupabaseSession } from "@/hooks/useSession";
import { lovable } from "@/integrations/lovable";
import { finishAccessFn, googleAccessFn } from "@/lib/auth.functions";
import { isGoogleBridgeSession, isLovableHost } from "@/lib/google-access";
import { onlyDigits } from "@/lib/salon";
import { supabase } from "@/lib/supabase-client";

type Ready = Extract<Awaited<ReturnType<typeof googleAccessFn>>, { status: "ready" }>;

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message.replace(/^Error:\s*/, "") : fallback;
}

const GOOGLE_LOGO = (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
    <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
  </svg>
);

/**
 * Entrar com Google: a sessão Google prova a identidade e é trocada pela conta
 * interna por telefone, para que agendamentos, fidelidade e pedidos continuem
 * na mesma conta de sempre.
 */
export function GoogleAccess({
  onBeforeSignIn,
  onSignedIn,
  onSignInFailed,
}: {
  onBeforeSignIn: () => void;
  onSignedIn: (userId: string) => Promise<void>;
  onSignInFailed: () => void;
}) {
  const { session, ready } = useSupabaseSession();
  const [busy, setBusy] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [referrerPhone, setReferrerPhone] = useState("");
  const handled = useRef<string | null>(null);

  async function complete(result: Ready) {
    onBeforeSignIn();
    // Lembra o telefone na conta Google para os próximos acessos com um toque.
    await supabase.auth
      .updateUser({ data: { jannah_phone: result.phone, jannah_name: result.fullName } })
      .catch(() => undefined);
    await supabase.auth.signOut({ scope: "local" });
    let userId: string | null = null;
    for (const password of [result.password, ...(result.fallbackPasswords ?? [])]) {
      const attempt = await supabase.auth.signInWithPassword({ email: result.email, password });
      if (!attempt.error && attempt.data.user) {
        userId = attempt.data.user.id;
        break;
      }
    }
    if (!userId) {
      onSignInFailed();
      toast.error("Não foi possível entrar agora. Tente novamente.");
      return;
    }
    // E-mail do Google fica no cadastro (usado pela Google Agenda) só se estiver vazio.
    if (result.googleEmail) {
      await supabase
        .from("profiles")
        .update({ email: result.googleEmail })
        .eq("id", userId)
        .or("email.is.null,email.eq.")
        .then(() => undefined, () => undefined);
    }
    await finishAccessFn({ data: { fullName: result.fullName } }).catch(() => undefined);
    toast.success(result.created ? "Cadastro criado. Bem-vinda!" : "Bem-vinda de volta!");
    await onSignedIn(userId);
  }

  async function resolve(input: { fullName?: string; phone?: string; referrerPhone?: string }) {
    setBusy(true);
    try {
      const result = await googleAccessFn({ data: input });
      if (result.status === "needs_phone") {
        setFullName((v) => v || result.suggestedName);
        setAskOpen(true);
        return;
      }
      setAskOpen(false);
      await complete(result);
    } catch (error) {
      onSignInFailed();
      toast.error(errorText(error, "Não foi possível entrar com o Google."));
    } finally {
      setBusy(false);
    }
  }

  // Volta do Google: a sessão ponte aparece e resolvemos a conta da cliente.
  useEffect(() => {
    const user = session?.user;
    if (!ready || !user || !isGoogleBridgeSession(user) || handled.current === user.id) return;
    handled.current = user.id;
    void resolve({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session]);

  async function startGoogle() {
    setBusy(true);
    // Fora da hospedagem Lovable (Vercel/jannahnails.com) o atalho /~oauth não
    // existe: usamos direto o login Google do backend com as credenciais próprias.
    if (!isLovableHost(window.location.hostname)) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account" } },
      });
      if (error) {
        setBusy(false);
        toast.error("Não foi possível abrir o Google. Tente novamente.");
      }
      return;
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) {
      setBusy(false);
      toast.error("Não foi possível abrir o Google. Tente novamente.");
      return;
    }
    if (result.redirected) return;
    setBusy(false);
  }

  async function cancel() {
    setAskOpen(false);
    handled.current = null;
    await supabase.auth.signOut({ scope: "local" });
    onSignInFailed();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (onlyDigits(phone).length < 10) {
      toast.error("Informe o telefone com DDD.");
      return;
    }
    void resolve({ fullName, phone: onlyDigits(phone), referrerPhone: onlyDigits(referrerPhone) });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void startGoogle()}
        disabled={busy}
        className="google-button flex h-10 w-full items-center justify-center gap-[10px] rounded-md px-3 text-sm font-medium disabled:opacity-60"
      >
        {GOOGLE_LOGO}
        <span>{busy ? "Conectando..." : "Continuar com Google"}</span>
      </button>
      <Dialog open={askOpen} onOpenChange={(open) => (open ? setAskOpen(true) : void cancel())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Falta só seu telefone</DialogTitle>
            <DialogDescription>
              Informe seu nome e WhatsApp com DDD. Se você já tem cadastro, sua conta é vinculada ao
              Google e todo o seu histórico continua igual.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="google-name">Nome</Label>
              <Input id="google-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google-phone">Telefone com DDD</Label>
              <PasswordInput
                id="google-phone"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(onlyDigits(e.target.value))}
                placeholder="(35) 99999-9999"
                maxLength={20}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google-referrer">Quem indicou você? (opcional, só no primeiro cadastro)</Label>
              <Input
                id="google-referrer"
                inputMode="numeric"
                value={referrerPhone}
                onChange={(e) => setReferrerPhone(onlyDigits(e.target.value))}
                maxLength={20}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Entrando..." : "Continuar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
