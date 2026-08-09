import { createServerFn } from "@tanstack/react-start";

export const clearFinanceHistoryFn = createServerFn({ method: "POST" }).handler(async () => {
  const { clearFinanceHistory } = await import("./finance-helpers.server");
  return clearFinanceHistory();
});
