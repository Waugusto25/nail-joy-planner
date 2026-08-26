import type { SupabaseClient } from "@supabase/supabase-js";

import { AUTH_EMAIL_DOMAIN, clientAccessPassword, loginEmail, onlyDigits } from "./salon";
import { getRequest } from "@tanstack/react-start/server";

import { resolveSupabasePublicConfig } from "./supabase-env";
import { createAdminClient } from "./supabase-admin.server";
import { createPublicClient, createTokenClient } from "./supabase-public.server";

/** Sinalizador usado pelo app para abrir o aviso acolhedor sobre indicação. */
export const REFERRAL_ONLY_FIRST_ACCESS = "REFERRAL_ONLY_FIRST_ACCESS";

type PhoneStatusRow = {
  registered: boolean;
  is_admin: boolean;
  has_referral: boolean;
  login_id: string | null;
  full_name: string | null;
  access_key: string | null;
  auth_phone: string | null;
};

/**
 * Converte a falha de leitura/gravação em algo acionável: o erro real vai para
 * o log do servidor e a cliente recebe uma mensagem específica por causa.
 */
function accessError(error: unknown, subject: string): Error {
  const e = error as { code?: string; message?: string; details?: string; hint?: string };
  console.error("[acesso] falha", {
    code: e?.code,
    message: e?.message,
    details: e?.details,
    hint: e?.hint,
  });
  if (e?.code === "23505" || /duplicate key/i.test(e?.message ?? ""))
    return new Error("Este telefone ou nome de acesso já está cadastrado. Tente entrar novamente.");
  if (e?.code === "42501" || /permission denied/i.test(e?.message ?? ""))
    return new Error("Configuração do banco sem permissão. Avise a administradora.");
  if (e?.code === "PGRST202" || e?.code === "PGRST205" || /schema cache/i.test(e?.message ?? ""))
    return new Error(
      "O site publicado está conectado a um banco sem as funções de acesso. Refaça o deploy.",
    );
  return new Error(`Não foi possível ${subject}. Tente novamente.`);
}

async function phoneRow(db: SupabaseClient, phone: string): Promise<PhoneStatusRow> {
  const { data, error } = await db.rpc("phone_login_status", { p_phone: phone });
  if (error) throw accessError(error, "consultar seu cadastro");
  const rows = (data ?? []) as PhoneStatusRow[];
  return (
    rows[0] ?? {
      registered: false,
      is_admin: false,
      has_referral: false,
      login_id: null,
      full_name: null,
      access_key: null,
      auth_phone: null,
    }
  );
}

/**
 * Senha interna da conta. Contas novas usam a chave de acesso do perfil, o que
 * desvincula a senha do telefone (a administradora pode corrigir o WhatsApp sem
 * derrubar o acesso). Contas antigas continuam derivando do telefone até a
 * primeira entrada, quando a chave é gerada.
 */
function passwordsFor(row: PhoneStatusRow, phone: string): string[] {
  if (row.access_key) return [row.access_key];
  // Contas antigas foram criadas com credenciais derivadas de formas diferentes;
  // tentamos todas e, no primeiro acesso, migramos para a chave própria.
  const candidates = [
    clientAccessPassword(row.auth_phone ?? phone),
    clientAccessPassword(phone),
    row.auth_phone ?? phone,
    phone,
  ];
  return Array.from(new Set(candidates.filter(Boolean)));
}

/** Situação do telefone: já cadastrado? já possui indicação vinculada? */
export async function phoneStatus(phone: string) {
  const row = await phoneRow(createPublicClient(), onlyDigits(phone));
  return { registered: row.registered, hasReferral: row.has_referral };
}

export type PhoneAccessResult = {
  created: boolean;
  loginId: string;
  email: string;
  password: string;
  /** Alternativas de credencial para contas criadas antes da chave de acesso. */
  fallbackPasswords: string[];
};

export async function phoneAccess(
  fullName: string,
  phone: string,
  referrerPhone?: string,
): Promise<PhoneAccessResult> {
  const db = createPublicClient();
  const normalizedPhone = onlyDigits(phone);
  if (normalizedPhone.length < 10 || normalizedPhone.length > 13) {
    throw new Error("Informe o telefone com DDD.");
  }

  const row = await phoneRow(db, normalizedPhone);

  if (row.registered) {
    // Antifraude: indicação vale só no primeiro cadastro; nunca sobrescreve o vínculo.
    if (onlyDigits(referrerPhone ?? "")) throw new Error(REFERRAL_ONLY_FIRST_ACCESS);
    if (row.is_admin) {
      throw new Error("Este telefone é da administradora. Use o acesso da administradora.");
    }
    const loginId = String(row.login_id);
    const passwords = passwordsFor(row, normalizedPhone);
    return {
      created: false,
      loginId,
      email: loginEmail(loginId),
      password: String(passwords[0]),
      fallbackPasswords: passwords.slice(1),
    };
  }

  const { data: allocated, error: allocateError } = await db.rpc("allocate_login_id", {
    p_full_name: fullName,
  });
  if (allocateError) throw accessError(allocateError, "preparar seu nome de acesso");
  const loginId = String(allocated);
  const email = loginEmail(loginId);
  const accessKey = crypto.randomUUID();

  const { data: signUp, error: signUpError } = await db.auth.signUp({
    email,
    password: accessKey,
    options: { data: { full_name: fullName.trim(), login_id: loginId, phone: normalizedPhone } },
  });
  if (signUpError || !signUp.user) {
    console.error("[acesso] falha no cadastro", signUpError);
    throw new Error("Não foi possível criar sua conta. Tente novamente.");
  }

  // A sessão do cadastro é usada para criar o perfil com as regras do banco.
  const token =
    signUp.session?.access_token ??
    (await db.auth.signInWithPassword({ email, password: accessKey })).data.session?.access_token;
  if (!token) throw new Error("Não foi possível concluir seu cadastro. Tente novamente.");

  const authed = createTokenClient(token);
  const { error: bootstrapError } = await authed.rpc("bootstrap_my_profile", {
    p_full_name: fullName.trim(),
    p_login_id: loginId,
    p_phone: normalizedPhone,
    p_access_key: accessKey,
  });
  if (bootstrapError) throw accessError(bootstrapError, "salvar seu cadastro");

  // Indicação: fica pendente até a nova cliente concluir o primeiro atendimento.
  const referrer = onlyDigits(referrerPhone ?? "");
  if (referrer && referrer !== normalizedPhone) {
    await authed.rpc("link_referral", { p_referrer_phone: referrer });
  }

  return { created: true, loginId, email, password: accessKey, fallbackPasswords: [] };
}

export async function resolveLogin(identifier: string) {
  const db = createPublicClient();
  const { data, error } = await db.rpc("resolve_login_id", { p_identifier: identifier });
  if (error) throw accessError(error, "localizar sua conta");
  if (!data) return { email: null, loginId: null };
  return { email: loginEmail(String(data)), loginId: String(data) };
}

/**
 * Fecha o primeiro acesso já com a sessão da cliente: acerta o nome quando ela
 * escreve diferente e migra contas antigas para a chave de acesso própria.
 */
/**
 * Troca a senha da conta usando o token da própria cliente na API de auth.
 * É o caminho possível sem credencial privada: o servidor não guarda sessão,
 * então falamos direto com o endpoint de usuário autenticado.
 */
async function rotatePassword(password: string): Promise<boolean> {
  let token: string | undefined;
  try {
    const header = getRequest()?.headers.get("authorization") ?? undefined;
    if (header?.toLowerCase().startsWith("bearer ")) token = header.slice(7).trim();
  } catch {
    token = undefined;
  }
  if (!token) return false;

  const { url, key } = resolveSupabasePublicConfig({
    serverUrl: process.env["SUPABASE_URL"],
    viteUrl: process.env["VITE_SUPABASE_URL"],
    serverPublishableKey: process.env["SUPABASE_PUBLISHABLE_KEY"],
    vitePublishableKey: process.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
  });

  const response = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    console.error("[acesso] falha ao rotacionar a senha", response.status, await response.text());
    return false;
  }
  return true;
}

export async function finishAccess(userId: string, fullName: string) {
  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("full_name, access_key")
    .eq("id", userId)
    .maybeSingle();

  const nextName = fullName.trim();
  if (nextName && String(profile?.full_name ?? "").trim() !== nextName) {
    await db.from("profiles").update({ full_name: nextName }).eq("id", userId);
  }

  // Conta antiga: migra para a chave de acesso própria, deixando o login
  // independente do telefone a partir do próximo acesso.
  if (!profile?.access_key) {
    const accessKey = crypto.randomUUID();
    if (!(await rotatePassword(accessKey))) return { ok: true as const, migrated: false };
    const { error } = await db.rpc("sync_my_access_key", { p_key: accessKey });
    if (error) {
      console.error("[acesso] falha ao registrar a chave de acesso", error);
      return { ok: true as const, migrated: false };
    }
    return { ok: true as const, migrated: true };
  }

  return { ok: true as const, migrated: false };
}

/** Corrige o WhatsApp da cliente sem derrubar o acesso dela. */
export async function adminUpdateClientAccess(clientId: string, phone: string) {
  const db = createAdminClient();
  const normalizedPhone = onlyDigits(phone);
  const { data: taken } = await db
    .from("profiles")
    .select("id")
    .eq("phone", normalizedPhone)
    .neq("id", clientId)
    .maybeSingle();
  if (taken) throw new Error("Esse telefone já está cadastrado em outra conta.");

  const { error } = await db
    .from("profiles")
    .update({ phone: normalizedPhone })
    .eq("id", clientId)
    .is("deleted_at", null);
  if (error) throw accessError(error, "atualizar o telefone");
  return { ok: true, domain: AUTH_EMAIL_DOMAIN };
}

/**
 * Exclusão da cliente: remove atendimentos, indicações, dispositivos e o papel,
 * e desativa o perfil. A linha de autenticação permanece inacessível, porque
 * removê-la exigiria credencial privada indisponível no deploy.
 */
export async function adminDeleteClient(clientId: string) {
  const db = createAdminClient();
  const { error } = await db.rpc("admin_soft_delete_client", { p_client: clientId });
  if (error) throw accessError(error, "excluir a conta da cliente");
  return { ok: true };
}

/**
 * Cadastro criado pela administradora no agendamento avulso. Sem credencial
 * privada, a conta nasce pelo próprio fluxo de inscrição (chave pública) e o
 * perfil é gravado com a sessão recém-criada.
 */
export async function ensureManualClient(fullName: string, phone: string) {
  const db = createPublicClient();
  const normalizedPhone = onlyDigits(phone);
  if (normalizedPhone.length < 10) throw new Error("Informe o telefone da cliente com DDD.");

  const { data: allocated, error: allocateError } = await db.rpc("allocate_login_id", {
    p_full_name: fullName,
  });
  if (allocateError) throw accessError(allocateError, "preparar o acesso da cliente");
  const loginId = String(allocated);
  const email = loginEmail(loginId);
  const accessKey = crypto.randomUUID();

  const { data: signUp, error: signUpError } = await db.auth.signUp({
    email,
    password: accessKey,
    options: { data: { full_name: fullName.trim(), login_id: loginId, phone: normalizedPhone } },
  });
  if (signUpError || !signUp.user) {
    console.error("[acesso] falha ao criar cliente manual", signUpError);
    throw new Error("Não foi possível criar o cadastro da cliente.");
  }

  const token =
    signUp.session?.access_token ??
    (await db.auth.signInWithPassword({ email, password: accessKey })).data.session?.access_token;
  if (!token) throw new Error("Não foi possível concluir o cadastro da cliente.");

  const { error: bootstrapError } = await createTokenClient(token).rpc("bootstrap_my_profile", {
    p_full_name: fullName.trim(),
    p_login_id: loginId,
    p_phone: normalizedPhone,
    p_access_key: accessKey,
  });
  if (bootstrapError) throw accessError(bootstrapError, "salvar o cadastro da cliente");

  return { clientId: String(signUp.user.id), created: true, loginId };
}
