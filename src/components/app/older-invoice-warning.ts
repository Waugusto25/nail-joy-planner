import type { QueryClient } from "@tanstack/react-query";

import { confirmDestructive } from "@/components/app/confirm-destructive-dialog";
import { formatISODate, formatPrice } from "@/lib/salon";
import {
  olderOpenInstallments,
  type StoreOrderInstallment,
  type StoreOrderWithDetails,
} from "@/lib/store";

/**
 * Antes de dar baixa, avisa se a cliente tem fatura mais antiga em aberto.
 * Resolve `true` quando não há fatura antiga ou quando a pessoa confirma.
 */
export async function confirmOlderInvoices(
  queryClient: QueryClient,
  order: StoreOrderWithDetails,
  parcel: StoreOrderInstallment,
): Promise<boolean> {
  const all = queryClient.getQueryData<StoreOrderWithDetails[]>(["admin-store-orders"]) ?? [order];
  const older = olderOpenInstallments(all, order, parcel);
  if (!older.length) return true;
  const list = older
    .slice(0, 4)
    .map(
      ({ order: o, parcel: p }) =>
        `Parcela ${p.number}${o.id !== order.id ? ` (outro pedido)` : ""} — vence ${p.due_date ? formatISODate(p.due_date) : "sem data"} — ${formatPrice(p.amount_cents)}`,
    )
    .join("; ");
  return confirmDestructive({
    title: "Cliente possui fatura mais antiga em aberto",
    description: `Atenção: ${order.client_name} tem ${older.length} fatura(s) anterior(es) não paga(s): ${list}. Deseja dar baixa na parcela ${parcel.number} mesmo assim?`,
    confirmLabel: "Dar baixa mesmo assim",
  });
}
