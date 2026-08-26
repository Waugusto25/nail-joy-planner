export type SupabaseEnvironment = {
  viteUrl?: unknown;
  serverUrl?: unknown;
  vitePublishableKey?: unknown;
  viteAnonKey?: unknown;
  serverPublishableKey?: unknown;
};

export type SupabasePublicConfig = {
  url: string;
  key: string;
};

const DEFAULT_SUPABASE_URL = "https://uhrurskyobcwleygmfam.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable__Yr_ekAvPGiJy-wZecQQkw_GztEAd3C";

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return undefined;
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
    url: url ?? DEFAULT_SUPABASE_URL,
    key: key ?? DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  };
}