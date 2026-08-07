import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { AUTH_EMAIL_DOMAIN, loginEmail, slugifyLogin, maskPhone } from "./salon";

type Admin = SupabaseClient;

function admin(): Admin {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function randomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function issueCode(db: Admin, phone: string, purpose: string) {
  const code = randomCode();
  await db
    .from("verification_codes")
    .update({ consumed: true })
    .eq("phone", phone)
    .eq("purpose", purpose)
    .eq("consumed", false);
  const { error } = await db.from("verification_codes").insert({ phone, code, purpose });
  if (error) throw new Error("Não foi possível gerar o código de verificação.");
  return code;
}

async function consumeCode(db: Admin, phone: string, purpose: string, code: string) {
  const { data } = await db
    .from("verification_codes")
    .select("id, code, expires_at")
    .eq("phone", phone)
    .eq("purpose", purpose)
    .eq("consumed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.code !== code) throw new Error("Código inválido. Confira os 4 dígitos.");
  if (new Date(data.expires_at as string).getTime() < Date.now()) {
    throw new Error("Código expirado. Solicite um novo.");
  }
  await db.from("verification_codes").update({ consumed: true }).eq("id", data.id);
}

async function uniqueLoginId(db: Admin, fullName: string) {
  const base = slugifyLogin(fullName) || "Cliente";
  const { data } = await db.from("profiles").select("login_id").ilike("login_id", `${base}%`);
  const taken = new Set((data ?? []).map((r) => String(r.login_id).toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 0; i < 60; i++) {
    const candidate = `${base}${Math.floor(100 + Math.random() * 900)}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base}${Date.now().toString().slice(-5)}`;
}

export async function startSignup(_fullName: string, phone: string) {
  const db = admin();
  const { data: existing } = await db
    .from("profiles")
    .select("login_id")
    .eq("phone", phone)
    .maybeSingle();
  if (existing) {
    return { alreadyRegistered: true, loginId: String(existing.login_id), code: null };
  }
  const code = await issueCode(db, phone, "signup");
  return { alreadyRegistered: false, loginId: null, code };
}

export async function finishSignup(fullName: string, phone: string, code: string) {
  const db = admin();
  const { data: existing } = await db
    .from("profiles")
    .select("login_id")
    .eq("phone", phone)
    .maybeSingle();
  if (existing) throw new Error("Este telefone já possui uma conta. Use a opção Entrar.");
  await consumeCode(db, phone, "signup", code);

  const loginId = await uniqueLoginId(db, fullName);
  const email = loginEmail(loginId);
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: phone,
    email_confirm: true,
    user_metadata: { full_name: fullName, login_id: loginId },
  });
  if (error || !created.user) throw new Error("Não foi possível criar sua conta. Tente novamente.");

  const { error: profileError } = await db
    .from("profiles")
    .insert({ id: created.user.id, full_name: fullName, login_id: loginId, phone });
  if (profileError) {
    await db.auth.admin.deleteUser(created.user.id);
    throw new Error("Não foi possível salvar seu cadastro. Tente novamente.");
  }
  await db.from("user_roles").insert({ user_id: created.user.id, role: "client" });
  return { loginId, email };
}

async function findProfile(db: Admin, identifier: string) {
  const slug = slugifyLogin(identifier);
  const byLogin = await db
    .from("profiles")
    .select("id, full_name, login_id, phone")
    .ilike("login_id", slug)
    .maybeSingle();
  if (byLogin.data) return byLogin.data;
  const byName = await db
    .from("profiles")
    .select("id, full_name, login_id, phone")
    .ilike("full_name", identifier)
    .limit(2);
  const rows = byName.data ?? [];
  if (rows.length === 1) return rows[0]!;
  return null;
}

export async function resolveLogin(identifier: string) {
  const db = admin();
  const profile = await findProfile(db, identifier);
  if (!profile) return { email: null, loginId: null };
  return { email: loginEmail(String(profile.login_id)), loginId: String(profile.login_id) };
}

export async function startRecovery(identifier: string) {
  const db = admin();
  const profile = await findProfile(db, identifier);
  if (!profile) throw new Error("Não encontramos essa conta. Confira o nome ou o ID de login.");
  const phone = String(profile.phone);
  const code = await issueCode(db, phone, "recovery");
  return { code, maskedPhone: maskPhone(phone), loginId: String(profile.login_id) };
}

export async function finishRecovery(identifier: string, code: string, phone: string) {
  const db = admin();
  const profile = await findProfile(db, identifier);
  if (!profile) throw new Error("Conta não encontrada.");
  await consumeCode(db, String(profile.phone), "recovery", code);
  const { error } = await db.auth.admin.updateUserById(String(profile.id), { password: phone });
  if (error) throw new Error("Não foi possível atualizar o acesso.");
  await db.from("profiles").update({ phone }).eq("id", profile.id);
  return { email: loginEmail(String(profile.login_id)), loginId: String(profile.login_id) };
}

export async function adminUpdateClientAccess(clientId: string, phone: string) {
  const db = admin();
  const { error } = await db.auth.admin.updateUserById(clientId, { password: phone });
  if (error) throw new Error("Não foi possível atualizar o acesso da cliente.");
  const { error: profileError } = await db.from("profiles").update({ phone }).eq("id", clientId);
  if (profileError) throw new Error("Não foi possível atualizar o telefone.");
  return { ok: true, domain: AUTH_EMAIL_DOMAIN };
}