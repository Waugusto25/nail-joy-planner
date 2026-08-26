import { createServerFn } from "@tanstack/react-start";

import { requireServerSupabaseAuth } from "./supabase-auth-middleware";

/** Limpa o histórico de faturamento (uso restrito à administradora). */
export const clearFinanceHistoryFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito à administradora.");
    const { clearFinanceHistory } = await import("./finance-helpers.server");
    return clearFinanceHistory();
  });
