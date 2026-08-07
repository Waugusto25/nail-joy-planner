import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSession";
import {
  finishRecoveryFn,
  finishSignupFn,
  resolveLoginFn,
  startRecoveryFn,
  startSignupFn,
} from "@/lib/auth.functions";
import { INSTAGRAM_URL, OWNER_NAME, SALON_NAME, onlyDigits } from "@/lib/salon";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jannah Nails — Entrar e agendar suas unhas" },
      {
        name: "description",
        content:
          "Acesse sua conta Jannah Nails para agendar manicure e pedicure, acompanhar seu cartão de fidelidade e ver a loja da Janaina.",
      },
      { property: "og:title", content: "Jannah Nails — Entrar e agendar" },
      {
        property: "og:description",
        content: "Entre com seu nome e telefone para agendar seus cuidados de unhas.",
      },
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

  useEffect(() => {
    if (ready && session) void navigate({ to: "/painel", replace: true });
  }, [ready, session, navigate]);

  return (
    <main className="bg-petal min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <BrandMark subtitle="Studio de unhas" />
        <h1 className="sr-only">
          {SALON_NAME} — acesso da cliente com {OWNER_NAME}
        </h1>

        <div className="surface-card mt-8 p-6">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="pt-5">
              <LoginForm />
            </TabsContent>
            <TabsContent value="signup" className="pt-5">
              <SignupForm />
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Siga o trabalho da Janaina no{" "}
          <a className="font-semibold text-primary underline" href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
            Instagram
          </a>
        </p>
      </div>
    </main>
  );
}

function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const { email } = await resolveLoginFn({ data: { identifier } });
      if (!email) {
        toast.error("Conta não encontrada. Confira o nome completo ou o ID de login.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Telefone ou senha incorretos.");
        return;
      }
      toast.success("Bem-vinda de volta!");
    } catch (error) {
      toast.error(message(error, "Não foi possível entrar agora."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="login-identifier">Nome completo ou ID de login</Label>
          <Input
            id="login-identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Maria Souza"
            maxLength={80}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Telefone (sua senha)</Label>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="35998844504"
            maxLength={60}
            required
          />
          <p className="text-xs text-muted-foreground">
            Use apenas os números do seu telefone, com DDD.
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
        <button
          type="button"
          className="w-full text-center text-xs font-semibold text-primary underline"
          onClick={() => setRecoveryOpen(true)}
        >
          Esqueci meu acesso
        </button>
      </form>
      <RecoveryDialog open={recoveryOpen} onOpenChange={setRecoveryOpen} />
    </>
  );
}

function SignupForm() {
  const [step, setStep] = useState<"dados" | "codigo" | "pronto">("dados");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [loginId, setLoginId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await startSignupFn({ data: { fullName, phone } });
      if (result.alreadyRegistered) {
        toast.error(`Este telefone já tem conta (ID ${result.loginId}). Use a aba Entrar.`);
        return;
      }
      setSentCode(result.code ?? null);
      setStep("codigo");
      toast.success("Enviamos um código de 4 dígitos para confirmar seu telefone.");
    } catch (error) {
      toast.error(message(error, "Confira os dados informados."));
    } finally {
      setLoading(false);
    }
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await finishSignupFn({ data: { fullName, phone, code } });
      setLoginId(result.loginId);
      setStep("pronto");
      const { error } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: onlyDigits(phone),
      });
      if (error) toast.error("Conta criada! Entre usando seu ID de login e telefone.");
    } catch (error) {
      toast.error(message(error, "Não foi possível concluir o cadastro."));
    } finally {
      setLoading(false);
    }
  }

  if (step === "pronto") {
    return (
      <div className="space-y-3 text-center">
        <p className="font-display text-xl">Cadastro concluído!</p>
        <p className="text-sm text-muted-foreground">Guarde seu ID de login:</p>
        <p className="rounded-xl bg-secondary px-4 py-3 text-lg font-bold tracking-wide text-secondary-foreground">
          {loginId}
        </p>
        <p className="text-xs text-muted-foreground">
          Sua senha é o seu telefone (somente números).
        </p>
      </div>
    );
  }

  if (step === "codigo") {
    return (
      <form className="space-y-4" onSubmit={confirm}>
        <p className="text-sm text-muted-foreground">
          Digite o código de 4 dígitos enviado para o telefone informado.
        </p>
        {sentCode ? (
          <p className="rounded-xl border border-dashed border-primary/40 bg-secondary/60 px-3 py-2 text-center text-sm">
            Código de verificação: <strong className="tracking-[0.35em]">{sentCode}</strong>
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="signup-code">Código</Label>
          <Input
            id="signup-code"
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(onlyDigits(e.target.value))}
            placeholder="0000"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Confirmando..." : "Confirmar cadastro"}
        </Button>
        <button
          type="button"
          className="w-full text-xs font-semibold text-primary underline"
          onClick={() => setStep("dados")}
        >
          Corrigir meus dados
        </button>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={requestCode}>
      <div className="space-y-2">
        <Label htmlFor="signup-name">Nome completo</Label>
        <Input
          id="signup-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Maria Souza"
          maxLength={80}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-phone">Telefone com DDD</Label>
        <Input
          id="signup-phone"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(onlyDigits(e.target.value))}
          placeholder="35998844504"
          maxLength={13}
          required
        />
        <p className="text-xs text-muted-foreground">
          O telefone será sua senha de acesso e receberá o código de verificação.
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Enviando código..." : "Continuar"}
      </Button>
    </form>
  );
}

function RecoveryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<{ code: string; masked: string; loginId: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function request(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await startRecoveryFn({ data: { identifier } });
      setSent({ code: result.code, masked: result.maskedPhone, loginId: result.loginId });
    } catch (error) {
      toast.error(message(error, "Não foi possível iniciar a recuperação."));
    } finally {
      setLoading(false);
    }
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await finishRecoveryFn({ data: { identifier, code, phone } });
      const { error } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: onlyDigits(phone),
      });
      if (error) throw new Error("Acesso atualizado. Entre novamente.");
      toast.success("Acesso recuperado!");
      onOpenChange(false);
    } catch (error) {
      toast.error(message(error, "Não foi possível recuperar o acesso."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Recuperar acesso</DialogTitle>
          <DialogDescription>
            Confirmamos sua identidade com um código de 4 dígitos enviado ao telefone cadastrado.
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <form className="space-y-4" onSubmit={confirm}>
            <p className="rounded-xl border border-dashed border-primary/40 bg-secondary/60 px-3 py-2 text-center text-sm">
              Código enviado para {sent.masked}: <strong className="tracking-[0.35em]">{sent.code}</strong>
            </p>
            <p className="text-xs text-muted-foreground">Seu ID de login é {sent.loginId}.</p>
            <div className="space-y-2">
              <Label htmlFor="rec-code">Código</Label>
              <Input
                id="rec-code"
                inputMode="numeric"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(onlyDigits(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-phone">Telefone atual (nova senha)</Label>
              <Input
                id="rec-phone"
                inputMode="numeric"
                maxLength={13}
                value={phone}
                onChange={(e) => setPhone(onlyDigits(e.target.value))}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Confirmando..." : "Recuperar acesso"}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={request}>
            <div className="space-y-2">
              <Label htmlFor="rec-id">Nome completo ou ID de login</Label>
              <Input
                id="rec-id"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                maxLength={80}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Enviar código"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}