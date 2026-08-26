import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  resolveSupabasePublicConfig,
} from "./supabase-env";

/**
 * Cliente de servidor com a chave pública (papel `anon`).
 * Substitui o cliente administrativo: nada aqui ignora RLS — o acesso
 * privilegiado acontece apenas dentro de funções SECURITY DEFINER do banco,
 * que validam quem chamou.
 */
function config() {
  return resolveSupabasePublicConfig({
    serverUrl: process.env["SUPABASE_URL"],
    viteUrl: process.env["VITE_SUPABASE_URL"],
    serverPublishableKey: process.env["SUPABASE_PUBLISHABLE_KEY"],
    vitePublishableKey: process.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
    viteAnonKey: process.env["SUPABASE_ANON_KEY"],
  });
}

/** Chaves novas (`sb_publishable_`) são opacas: vão em `apikey`, nunca como Bearer JWT. */
function publicFetch(key: string, accessToken?: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, header) => headers.set(header, value));
    }
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

function build(accessToken?: string): SupabaseClient {
  const { url, key } = config();
  return createClient(url, key || DEFAULT_SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { fetch: publicFetch(key || DEFAULT_SUPABASE_PUBLISHABLE_KEY, accessToken) },
  });
}

/** Cliente anônimo: leituras públicas e funções SECURITY DEFINER liberadas para `anon`. */
export function createPublicClient(): SupabaseClient {
  return build();
}

/** Cliente agindo como a pessoa dona do token (RLS aplicada a ela). */
export function createTokenClient(accessToken: string): SupabaseClient {
  return build(accessToken);
}
