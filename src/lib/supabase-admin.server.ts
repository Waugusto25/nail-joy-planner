import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://uhrurskyobcwleygmfam.supabase.co";

function normalized(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

export function createAdminClient(): SupabaseClient {
  const url = normalized(process.env["SUPABASE_URL"]) ?? DEFAULT_SUPABASE_URL;
  const serviceRoleKey =
    normalized(process.env["SUPABASE_SERVICE_ROLE_KEY"]) ??
    normalized(process.env["SUPABASE_SECRET_KEY"]);

  if (!serviceRoleKey) {
    throw new Error(
      "Configuração do servidor ausente: SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEY é obrigatória para operações administrativas.",
    );
  }

  // Chaves novas (sb_secret_/sb_publishable_) são opacas, não JWT. Enviá-las como
  // "Authorization: Bearer" faz a API de dados falhar com "Expected 3 parts in JWT".
  const isJwt = serviceRoleKey.split(".").length === 3;
  const headers: Record<string, string> = { apikey: serviceRoleKey };
  if (isJwt) headers["Authorization"] = `Bearer ${serviceRoleKey}`;

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers },
  });
}
