import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://uhrurskyobcwleygmfam.supabase.co";

function normalized(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

function serviceRoleFetch(serviceRoleKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // O formato sb_secret_ é uma API key opaca, não um JWT. O cliente padrão
    // tenta enviá-la como Bearer; isso perde a identidade administrativa no Data API.
    if (serviceRoleKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${serviceRoleKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", serviceRoleKey);
    return fetch(input, { ...init, headers });
  };
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
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: serviceRoleFetch(serviceRoleKey) },
  });
}
