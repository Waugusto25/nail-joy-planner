import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { onlyDigits } from "./salon";

import {
  adminDeleteClientInput,
  adminUpdateClientInput,
  phoneAccessInput,
  finishAccessInput,
  phoneStatusInput,
  resolveLoginInput,
} from "./auth-schemas";
import { requireServerSupabaseAuth } from "./supabase-auth-middleware";

export const phoneAccessFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => phoneAccessInput.parse(data))
  .handler(async ({ data }) => {
    const { phoneAccess } = await import("./auth-helpers.server");
    return phoneAccess(data.fullName, data.phone, data.referrerPhone);
  });

/** Fecha o primeiro acesso com a sessão da cliente (nome e chave de acesso). */
export const finishAccessFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => finishAccessInput.parse(data))
  .handler(async ({ data, context }) => {
    const { finishAccess } = await import("./auth-helpers.server");
    return finishAccess(context.userId, data.fullName);
  });

export const resolveLoginFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => resolveLoginInput.parse(data))
  .handler(async ({ data }) => {
    const { resolveLogin } = await import("./auth-helpers.server");
    return resolveLogin(data.identifier);
  });

export const phoneStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => phoneStatusInput.parse(data))
  .handler(async ({ data }) => {
    const { phoneStatus } = await import("./auth-helpers.server");
    return phoneStatus(data.phone);
  });

export const adminUpdateClientFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => adminUpdateClientInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito à administradora.");
    const { adminUpdateClientAccess } = await import("./auth-helpers.server");
    return adminUpdateClientAccess(context.supabase, data.clientId, data.phone);
  });

export const adminDeleteClientFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => adminDeleteClientInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito à administradora.");
    if (data.clientId === context.userId)
      throw new Error("Você não pode excluir sua própria conta.");
    const { adminDeleteClient } = await import("./auth-helpers.server");
    return adminDeleteClient(context.supabase, data.clientId);
  });

const googleAccessInput = z.object({
  fullName: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  referrerPhone: z.string().trim().max(20).optional(),
});

/**
 * Entrada pelo Google: com a sessão Google comprovada, resolve a conta interna
 * pelo telefone (a mesma regra do acesso por telefone). Sem telefone conhecido,
 * pede nome e telefone; telefone lembrado que deixou de existir nunca cria
 * conta nova sozinho, para não duplicar a cliente.
 */
export const googleAccessFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((data: unknown) => googleAccessInput.parse(data))
  .handler(async ({ data, context }) => {
    const claims = context.claims as {
      email?: string;
      app_metadata?: { provider?: string; providers?: string[] };
      user_metadata?: Record<string, unknown>;
    };
    const providers = claims.app_metadata?.providers ?? [];
    if (claims.app_metadata?.provider !== "google" && !providers.includes("google"))
      throw new Error("Entre com o Google para continuar.");

    const meta = claims.user_metadata ?? {};
    const suggestedName = String(meta["jannah_name"] ?? meta["full_name"] ?? meta["name"] ?? "").trim();
    const rememberedPhone = String(meta["jannah_phone"] ?? "");
    const typedPhone = onlyDigits(data.phone ?? "");
    const phone = typedPhone || onlyDigits(rememberedPhone);
    const fullName = (data.fullName ?? "").trim() || suggestedName;

    const { phoneAccess, phoneStatus } = await import("./auth-helpers.server");
    if (!phone || fullName.length < 2) return { status: "needs_phone" as const, suggestedName };
    if (!typedPhone && !(await phoneStatus(phone)).registered)
      return { status: "needs_phone" as const, suggestedName };

    const result = await phoneAccess(fullName, phone, typedPhone ? data.referrerPhone : "");
    return {
      status: "ready" as const,
      ...result,
      fullName,
      phone,
      googleEmail: claims.email ?? "",
    };
  });
