import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  adminUpdateClientInput,
  finishRecoveryInput,
  finishSignupInput,
  resolveLoginInput,
  startRecoveryInput,
  startSignupInput,
} from "./auth-schemas";

export const startSignupFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => startSignupInput.parse(data))
  .handler(async ({ data }) => {
    const { startSignup } = await import("./auth-helpers.server");
    return startSignup(data.fullName, data.phone);
  });

export const finishSignupFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => finishSignupInput.parse(data))
  .handler(async ({ data }) => {
    const { finishSignup } = await import("./auth-helpers.server");
    return finishSignup(data.fullName, data.phone, data.code);
  });

export const resolveLoginFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => resolveLoginInput.parse(data))
  .handler(async ({ data }) => {
    const { resolveLogin } = await import("./auth-helpers.server");
    return resolveLogin(data.identifier);
  });

export const startRecoveryFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => startRecoveryInput.parse(data))
  .handler(async ({ data }) => {
    const { startRecovery } = await import("./auth-helpers.server");
    return startRecovery(data.identifier);
  });

export const finishRecoveryFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => finishRecoveryInput.parse(data))
  .handler(async ({ data }) => {
    const { finishRecovery } = await import("./auth-helpers.server");
    return finishRecovery(data.identifier, data.code, data.phone);
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