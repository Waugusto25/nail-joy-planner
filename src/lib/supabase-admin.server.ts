import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://uhrurskyobcwleygmfam.supabase.co";

function normalized(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

export function createAdminClient(): SupabaseClient {
  const url = normalized(process.env["SUPABASE_URL"]) ?? DEFAULT_SUPABASE_URL;
  const serviceRoleKey = normalized(process.env["SUPABASE_SERVICE_ROLE_KEY"]);

  if (!serviceRoleKey) {
    throw new Error(
      "Configuração do servidor ausente: SUPABASE_SERVICE_ROLE_KEY é obrigatória para operações administrativas.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}