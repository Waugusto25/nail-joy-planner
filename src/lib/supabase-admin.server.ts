import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";

import { createPublicClient, createTokenClient } from "./supabase-public.server";

/**
 * Cliente de banco do pedido em andamento.
 *
 * Não existe mais credencial privada: usamos a chave pública e o token de quem
 * chamou, então o RLS decide o que pode ser lido e escrito (a administradora
 * enxerga tudo pelas policies com `has_role`). Operações que precisam de
 * privilégio real vivem em funções SECURITY DEFINER no banco.
 */
export function createAdminClient(): SupabaseClient {
  let token: string | undefined;
  try {
    const header = getRequest()?.headers.get("authorization") ?? undefined;
    if (header?.toLowerCase().startsWith("bearer ")) token = header.slice(7).trim();
  } catch {
    token = undefined;
  }
  return token ? createTokenClient(token) : createPublicClient();
}
