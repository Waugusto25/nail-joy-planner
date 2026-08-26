import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/app/brand";
import { CalendarSyncDialog } from "@/components/app/calendar-sync-dialog";
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
    if (ready && session && gate === "idle") void navigate({ to: "/painel", replace: true });
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
          <h2 className="font-display text-xl">Entrar ou criar conta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe seu nome e seu telefone. Se já tiver conta, você entra direto; se for a primeira
            vez, criamos seu cadastro na hora.
          </p>
          <div className="pt-5">
            <PhoneAccessForm
              onBeforeSignIn={() => setGate("checking")}
              onSignedIn={afterClientSignIn}
              onSignInFailed={() => setGate("idle")}
            />
          </div>
        </div>

        <div className="mt-5 text-center">
          <button
            type="button"
            className="text-xs font-semibold text-primary underline"
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

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Siga o trabalho da Janaina no{" "}
          <a
            className="font-semibold text-primary underline"
            href={settings.data?.instagram_url ?? salonInstagram()}
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
        </p>
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
