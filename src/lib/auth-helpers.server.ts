import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { AUTH_EMAIL_DOMAIN, loginEmail, slugifyLogin } from "./salon";

type Admin = SupabaseClient;

function admin(): Admin {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

export async function phoneAccess(fullName: string, phone: string) {
  const db = admin();
  const { data: existing } = await db
    .from("profiles")
    .select("id, full_name, login_id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    const { data: roles } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", existing.id)
      .eq("role", "admin");
    if ((roles ?? []).length > 0) {
      throw new Error("Este telefone é da administradora. Use o acesso da administradora.");
    }
    if (String(existing.full_name).trim() !== fullName.trim()) {
      await db.from("profiles").update({ full_name: fullName }).eq("id", existing.id);
      await db.auth.admin.updateUserById(String(existing.id), {
        user_metadata: { full_name: fullName, login_id: existing.login_id },
      });
    }
    // Garante que o telefone atual continua sendo a senha válida.
    await db.auth.admin.updateUserById(String(existing.id), { password: phone });
    return {
      created: false,
      loginId: String(existing.login_id),
      email: loginEmail(String(existing.login_id)),
    };
  }

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
  return { created: true, loginId, email };
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

export async function adminUpdateClientAccess(clientId: string, phone: string) {
  const db = admin();
  const { error } = await db.auth.admin.updateUserById(clientId, { password: phone });
  if (error) throw new Error("Não foi possível atualizar o acesso da cliente.");
  const { error: profileError } = await db.from("profiles").update({ phone }).eq("id", clientId);
  if (profileError) throw new Error("Não foi possível atualizar o telefone.");
  return { ok: true, domain: AUTH_EMAIL_DOMAIN };
}