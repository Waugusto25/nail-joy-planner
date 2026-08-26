import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  adminDeleteClientInput,
  adminUpdateClientInput,
  phoneAccessInput,
  finishAccessInput,
  phoneStatusInput,
  resolveLoginInput,
} from "./auth-schemas";

export const phoneAccessFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => phoneAccessInput.parse(data))
  .handler(async ({ data }) => {
    const { phoneAccess } = await import("./auth-helpers.server");
    return phoneAccess(data.fullName, data.phone, data.referrerPhone);
  });

/** Fecha o primeiro acesso com a sessão da cliente (nome e chave de acesso). */
export const finishAccessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => adminUpdateClientInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito à administradora.");
    const { adminUpdateClientAccess } = await import("./auth-helpers.server");
    return adminUpdateClientAccess(data.clientId, data.phone);
  });

export const adminDeleteClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    return adminDeleteClient(data.clientId);
  });
