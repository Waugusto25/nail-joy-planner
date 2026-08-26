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

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return undefined;
}

export function resolveSupabasePublicConfig(environment: SupabaseEnvironment): SupabasePublicConfig {
  const url = firstNonEmptyString(environment.viteUrl, environment.serverUrl);
  const key = firstNonEmptyString(
    environment.vitePublishableKey,
    environment.viteAnonKey,
    environment.serverPublishableKey,
  );

  if (!url || !key) {
    const missing = [
      ...(!url ? ["VITE_SUPABASE_URL or SUPABASE_URL"] : []),
      ...(!key
        ? [
            "VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_ANON_KEY, or SUPABASE_PUBLISHABLE_KEY",
          ]
        : []),
    ];
    throw new Error(`Missing or empty backend environment variable(s): ${missing.join("; ")}.`);
  }

  return { url, key };
}