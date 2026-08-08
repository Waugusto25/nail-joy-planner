import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/app/brand";
import { PasswordInput } from "@/components/app/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSession";
import { phoneAccessFn, resolveLoginFn } from "@/lib/auth.functions";
import { INSTAGRAM_URL, OWNER_NAME, SALON_NAME, onlyDigits } from "@/lib/salon";

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
          <h2 className="font-display text-xl">Entrar ou criar conta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe seu nome e seu telefone. Se já tiver conta, você entra direto; se for a primeira
            vez, criamos seu cadastro na hora.
          </p>
          <div className="pt-5">
            <PhoneAccessForm />
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
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
        </p>
      </div>
    </main>
  );
}

function PhoneAccessForm() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [referrerPhone, setReferrerPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await phoneAccessFn({ data: { fullName, phone, referrerPhone } });
      const { error } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: onlyDigits(phone),
      });
      if (error) {
        toast.error("Não foi possível entrar agora. Tente novamente.");
        return;
      }
      toast.success(result.created ? "Cadastro criado. Bem-vinda!" : "Bem-vinda de volta!");
    } catch (error) {
      toast.error(message(error, "Confira os dados informados."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="access-name">Nome completo</Label>
        <Input
          id="access-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Maria Souza"
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
          placeholder="35998844504"
          maxLength={13}
          required
        />
        <p className="text-xs text-muted-foreground">
          Seu telefone é o seu acesso. Toque no olhinho para conferir os números.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="access-referrer">Quem indicou você? (opcional)</Label>
        <Input
          id="access-referrer"
          inputMode="numeric"
          value={referrerPhone}
          onChange={(e) => setReferrerPhone(onlyDigits(e.target.value))}
          placeholder="Telefone da amiga com DDD"
          maxLength={13}
        />
        <p className="text-xs text-muted-foreground">
          A amiga que te indicou ganha 10% de desconto depois do seu primeiro atendimento
          concluído.
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
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
      const { email } = await resolveLoginFn({ data: { identifier } });
      if (!email) {
        toast.error("Conta não encontrada. Confira o ID de login.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
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
          placeholder="JannahSilva"
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
