import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  adminDeleteClientInput,
  adminUpdateClientInput,
  phoneAccessInput,
  resolveLoginInput,
} from "./auth-schemas";

export const phoneAccessFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => phoneAccessInput.parse(data))
  .handler(async ({ data }) => {
    const { phoneAccess } = await import("./auth-helpers.server");
    return phoneAccess(data.fullName, data.phone, data.referrerPhone);
  });

export const resolveLoginFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => resolveLoginInput.parse(data))
  .handler(async ({ data }) => {
    const { resolveLogin } = await import("./auth-helpers.server");
    return resolveLogin(data.identifier);
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
