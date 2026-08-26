export type SupabaseEnvironment = {
  viteUrl?: unknown;
  serverUrl?: unknown;
  vitePublishableKey?: unknown;
  viteAnonKey?: unknown;
  serverPublishableKey?: unknown;
};

export type SupabaseServerEnvironment = {
  viteUrl?: unknown;
  serverUrl?: unknown;
};

export type SupabasePublicConfig = {
  url: string;
  key: string;
};

export const DEFAULT_SUPABASE_URL = "https://uhrurskyobcwleygmfam.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable__Yr_ekAvPGiJy-wZecQQkw_GztEAd3C";

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return undefined;
}

function normalizedUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Mantém navegador e funções de servidor apontando para o mesmo backend. */
export function resolveSupabaseServerUrl(environment: SupabaseServerEnvironment): string {
  const viteUrl = firstNonEmptyString(environment.viteUrl);
  const serverUrl = firstNonEmptyString(environment.serverUrl);

  if (viteUrl && serverUrl && normalizedUrl(viteUrl) !== normalizedUrl(serverUrl)) {
    throw new Error(
      "Configuração do deploy inconsistente: VITE_SUPABASE_URL e SUPABASE_URL apontam para bancos diferentes.",
    );
  }

  return normalizedUrl(viteUrl ?? serverUrl ?? DEFAULT_SUPABASE_URL);
}

export function resolveSupabasePublicConfig(environment: SupabaseEnvironment): SupabasePublicConfig {
  const url = firstNonEmptyString(
    environment.viteUrl,
    environment.serverUrl,
    DEFAULT_SUPABASE_URL,
  );
  const key = firstNonEmptyString(
    environment.vitePublishableKey,
    environment.viteAnonKey,
    environment.serverPublishableKey,
    DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  );

  return {
    url: normalizedUrl(url ?? DEFAULT_SUPABASE_URL),
    key: key ?? DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  };
}