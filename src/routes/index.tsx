import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/app/brand";
import { CalendarSyncDialog } from "@/components/app/calendar-sync-dialog";
import { GoogleAccess } from "@/components/app/google-access";
import { isGoogleBridgeSession } from "@/lib/google-access";
import { PasswordInput } from "@/components/app/password-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase-client";
import { useSupabaseSession } from "@/hooks/useSession";
import {
  finishAccessFn,
  phoneAccessFn,
  phoneStatusFn,
  resolveLoginFn,
} from "@/lib/auth.functions";
import { useAppSettings } from "@/hooks/useSettings";
import {
  OWNER_NAME,
  SALON_NAME,
  loginEmail,
  onlyDigits,
  salonInstagram,
  slugifyLogin,
} from "@/lib/salon";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jannah Nails — Entrar e agendar suas unhas" },
      {
        name: "description",
        content:
          "Acesse sua conta Jannah Nails com nome e telefone para agendar manicure e pedicure, acompanhar seu cartão de fidelidade e ver a loja da Janaina.",
      },
      { property: "og:title", content: "Jannah Nails — Entrar e agendar suas unhas" },
      {
        property: "og:description",
        content:
          "Acesse sua conta Jannah Nails com nome e telefone para agendar manicure e pedicure, acompanhar seu cartão de fidelidade e ver a loja da Janaina.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function message(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message.replace(/^Error:\s*/, "");
  return fallback;
}

function AuthPage() {
  const navigate = useNavigate();
  const { session, ready } = useSupabaseSession();
  const [adminOpen, setAdminOpen] = useState(false);
  const settings = useAppSettings();
  // "idle" navega direto; "checking"/"prompt" seguram o redirecionamento até
  // a cliente responder ao aviso da Google Agenda.
  const [gate, setGate] = useState<"idle" | "checking" | "prompt">("idle");

  useEffect(() => {
    if (ready && session && gate === "idle" && !isGoogleBridgeSession(session.user)) void navigate({ to: "/painel", replace: true });
  }, [ready, session, navigate, gate]);

  async function afterClientSignIn(userId: string) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("email, calendar_prompt_dismissed")
        .eq("id", userId)
        .maybeSingle();
      const hasEmail = Boolean(String(data?.email ?? "").trim());
      setGate(!hasEmail && !data?.calendar_prompt_dismissed ? "prompt" : "idle");
    } catch {
      setGate("idle");
    }
  }

  return (
    <main className="bg-petal min-h-screen px-4 py-10">
      <div className="bg-petal-veil" aria-hidden="true" />
      <div className="mx-auto w-full max-w-md">
        <BrandMark subtitle="Studio de unhas" />
        <h1 className="sr-only">
          {SALON_NAME} — acesso da cliente com {OWNER_NAME}
        </h1>

        <div className="surface-card mt-8 p-6">
          <h2 className="font-display text-xl">Bem-vinda ao nosso espaço ✨</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu momento de cuidado começa aqui. Entre ou cadastre-se em segundos.
          </p>
          <div className="pt-5">
            <GoogleAccess
              onBeforeSignIn={() => setGate("checking")}
              onSignedIn={afterClientSignIn}
              onSignInFailed={() => setGate("idle")}
            />
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou com nome e telefone
              <span className="h-px flex-1 bg-border" />
            </div>
            <PhoneAccessForm
              onBeforeSignIn={() => setGate("checking")}
              onSignedIn={afterClientSignIn}
              onSignInFailed={() => setGate("idle")}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <a
            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={settings.data?.instagram_url ?? salonInstagram()}
            target="_blank"
            rel="noreferrer"
            aria-label="Conheça nosso trabalho no Instagram (abre em nova aba)"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.88 5.88 0 0 0-2.13 1.38A5.88 5.88 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13a5.88 5.88 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.88 5.88 0 0 0 2.13-1.38 5.88 5.88 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.88 5.88 0 0 0-1.38-2.13A5.88 5.88 0 0 0 19.86.63C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z" />
            </svg>
            Conheça nosso trabalho no Instagram
          </a>
        </div>

        <div className="mt-8 text-center">
          <button
            type="button"
            className="text-xs text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            onClick={() => setAdminOpen((v) => !v)}
          >
            Acesso da administradora
          </button>
        </div>
        {adminOpen ? (
          <div className="surface-card mt-3 p-6">
            <AdminLoginForm />
          </div>
        ) : null}

      </div>
      <CalendarSyncDialog open={gate === "prompt"} onDone={() => setGate("idle")} />
    </main>
  );
}

function PhoneAccessForm({
  onBeforeSignIn,
  onSignedIn,
  onSignInFailed,
}: {
  onBeforeSignIn: () => void;
  onSignedIn: (userId: string) => Promise<void>;
  onSignInFailed: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [referrerPhone, setReferrerPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [referralNoticeOpen, setReferralNoticeOpen] = useState(false);

  // Verifica (com debounce) se o telefone já tem cadastro para esconder a indicação.
  useEffect(() => {
    const digits = onlyDigits(phone);
    if (digits.length < 10) {
      setRegistered(false);
      return;
    }
    let active = true;
    const id = setTimeout(() => {
      void phoneStatusFn({ data: { phone: digits } })
        .then((status) => {
          if (!active) return;
          setRegistered(status.registered);
          if (status.registered) setReferrerPhone("");
        })
        .catch(() => undefined);
    }, 450);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [phone]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await phoneAccessFn({
        data: { fullName, phone, referrerPhone: registered ? "" : referrerPhone },
      });
      onBeforeSignIn();
      // Contas antigas podem ter credencial derivada de outra forma: tentamos as alternativas.
      const candidates = [result.password, ...(result.fallbackPasswords ?? [])];
      let signIn: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] | null = null;
      let error: unknown = null;
      for (const password of candidates) {
        const attempt = await supabase.auth.signInWithPassword({ email: result.email, password });
        if (!attempt.error && attempt.data.user) {
          signIn = attempt.data;
          error = null;
          break;
        }
        error = attempt.error;
      }
      if (error || !signIn) {
        onSignInFailed();
        toast.error("Não foi possível entrar agora. Tente novamente.");
        return;
      }
      // Já com sessão: acerta o nome e migra contas antigas para a chave própria.
      await finishAccessFn({ data: { fullName } }).catch(() => undefined);
      toast.success(result.created ? "Cadastro criado. Bem-vinda!" : "Bem-vinda de volta!");
      if (signIn.user) await onSignedIn(signIn.user.id);
      else onSignInFailed();
    } catch (error) {
      onSignInFailed();
      if (error instanceof Error && error.message.includes("REFERRAL_ONLY_FIRST_ACCESS")) {
        setRegistered(true);
        setReferrerPhone("");
        setReferralNoticeOpen(true);
        return;
      }
      toast.error(message(error, "Confira os dados informados."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="access-name">Nome</Label>
        <Input
          id="access-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ex: Maria Silva"
          maxLength={80}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="access-phone">Telefone com DDD</Label>
        <PasswordInput
          id="access-phone"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(onlyDigits(e.target.value))}
          placeholder="(35) 99999-9999"
          maxLength={20}
          required
        />
        <p className="text-xs text-muted-foreground">
          Seu telefone é o seu acesso. Toque no olhinho para conferir os números.
        </p>
      </div>
      {registered ? (
        <p className="text-xs text-muted-foreground">
          Você já tem cadastro no {SALON_NAME} — é só entrar. O campo de indicação aparece apenas no
          primeiro acesso.
        </p>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="access-referrer">Quem indicou você? (opcional)</Label>
          <Input
            id="access-referrer"
            inputMode="numeric"
            value={referrerPhone}
            onChange={(e) => setReferrerPhone(onlyDigits(e.target.value))}
            placeholder="(35) 99999-9999"
            maxLength={20}
          />
          <p className="text-xs text-muted-foreground">
            A amiga que te indicou ganha 10% de desconto depois do seu primeiro atendimento
            concluído.
          </p>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
    <Dialog open={referralNoticeOpen} onOpenChange={setReferralNoticeOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Obrigada pelo carinho! 💖</DialogTitle>
          <DialogDescription className="space-y-3 text-left">
            <span className="block">
              Identificamos que você já possui cadastro no {SALON_NAME}! O desconto do programa
              Indique e Ganhe é válido apenas para o seu primeiro acesso ao nosso aplicativo.
            </span>
            <span className="block">
              Mas não se preocupe: agora é a sua vez! Compartilhe o aplicativo com suas amigas, peça
              para elas digitarem o seu número no cadastro e ganhe 10% de desconto a cada nova amiga
              que agendar! ✨
            </span>
          </DialogDescription>
        </DialogHeader>
        <Button className="w-full" onClick={() => setReferralNoticeOpen(false)}>
          Entendi, quero entrar
        </Button>
      </DialogContent>
    </Dialog>
    </>
  );
}

function AdminLoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      // A consulta no servidor pode falhar por configuração de ambiente; nesse caso
      // derivamos o e-mail interno a partir do próprio ID digitado.
      let email: string | null = null;
      try {
        email = (await resolveLoginFn({ data: { identifier } })).email;
      } catch {
        email = null;
      }
      const fallback = slugifyLogin(identifier) ? loginEmail(identifier) : null;
      const target = email ?? fallback;
      if (!target) {
        toast.error("Informe o ID de login da administradora.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: target, password });
      if (error) {
        toast.error("ID de login ou senha incorretos.");
        return;
      }

      toast.success("Bem-vinda, Janaina!");
    } catch (error) {
      toast.error(message(error, "Não foi possível entrar agora."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="admin-id">ID de login</Label>
        <Input
          id="admin-id"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Seu ID de login"
          maxLength={80}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-password">Senha</Label>
        <PasswordInput
          id="admin-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          maxLength={60}
          required
        />
      </div>
      <Button type="submit" variant="secondary" className="w-full" disabled={loading}>
        {loading ? "Entrando..." : "Entrar como administradora"}
      </Button>
    </form>
  );
}
