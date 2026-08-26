import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { DEFAULT_SUPABASE_PUBLISHABLE_KEY, resolveSupabasePublicConfig } from "./supabase-env";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function resolveServerSupabaseConfig(): { url: string; key: string } {
  const config = resolveSupabasePublicConfig({
    serverUrl: process.env["SUPABASE_URL"],
    viteUrl: process.env["VITE_SUPABASE_URL"],
    serverPublishableKey: process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"],
    vitePublishableKey: process.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
    viteAnonKey: process.env["VITE_SUPABASE_ANON_KEY"],
  });

  return { url: config.url, key: config.key || DEFAULT_SUPABASE_PUBLISHABLE_KEY };
}

function readBearerToken(): string {
  const request = getRequest();
  const authHeader = request?.headers.get("authorization") ?? "";

  if (!authHeader) throw new Error("Sessão expirada. Entre novamente e tente excluir a cliente.");
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    throw new Error("Sessão inválida. Entre novamente e tente excluir a cliente.");
  }

  const token = authHeader.slice(7).trim();
  if (!token || token.split(".").length !== 3) {
    throw new Error("Sessão inválida. Entre novamente e tente excluir a cliente.");
  }

  return token;
}

export const requireServerSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const token = readBearerToken();
    const { url, key } = resolveServerSupabaseConfig();

    const supabase = createClient<Database>(url, key, {
      global: {
        fetch: createSupabaseFetch(key),
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      throw new Error("Sessão expirada. Entre novamente e tente excluir a cliente.");
    }

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
      },
    });
  },
);