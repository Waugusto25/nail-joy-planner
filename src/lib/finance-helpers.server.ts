import { admin } from "./push-helpers.server";

/**
 * Limpeza usada na fase de testes: apaga os atendimentos já concluídos
 * (registros de receita) e os pedidos da loja, zerando o faturamento.
 */
export async function clearFinanceHistory() {
  const db = admin();
  const { data: appts, error } = await db
    .from("appointments")
    .delete()
    .eq("status", "concluido")
    .select("id");
  if (error) throw new Error("Não foi possível limpar o faturamento dos atendimentos.");
  const { data: orders } = await db.from("store_orders").delete().neq("id", "").select("id");
  return {
    appointments: (appts ?? []).length,
    orders: (orders ?? []).length,
  };
}
