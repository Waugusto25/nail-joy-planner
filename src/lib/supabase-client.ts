import { createClient } from "@supabase/supabase-js";

import { brokeredPreviewStorage } from "@/integrations/supabase/previewAuthStorage";
import type { Database } from "@/integrations/supabase/types";
import { resolveSupabasePublicConfig } from "@/lib/supabase-env";

function isOpaqueApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createPublicClientFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isOpaqueApiKey(apiKey) && headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseBrowserClient() {
  const serverEnvironment = typeof process === "undefined" ? undefined : process.env;
  const { url, key } = resolveSupabasePublicConfig({
    viteUrl: import.meta.env["VITE_SUPABASE_URL"],
    serverUrl: serverEnvironment?.["SUPABASE_URL"],
    vitePublishableKey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
    viteAnonKey: import.meta.env["VITE_SUPABASE_ANON_KEY"],
    serverPublishableKey: serverEnvironment?.["SUPABASE_PUBLISHABLE_KEY"],
  });

  return createClient<Database>(url, key, {
    global: { fetch: createPublicClientFetch(key) },
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let client: ReturnType<typeof createSupabaseBrowserClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseBrowserClient>, {
  get(_, property, receiver) {
    client ??= createSupabaseBrowserClient();
    return Reflect.get(client, property, receiver);
  },
});