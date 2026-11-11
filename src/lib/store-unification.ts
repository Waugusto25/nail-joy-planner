import { onlyDigits } from "./salon";
import { addMonthsISO, type StoreOrderWithDetails, type StoreOrderInstallment } from "./store";
import { remainingCents } from "./store-advance";

export function unificationSources(orders: StoreOrderWithDetails[], clientId: string, phone: string): StoreOrderInstallment[] {
  const digits = onlyDigits(phone);
  return orders.filter((order) => order.store_client_id ? order.store_client_id === clientId : Boolean(digits) && onlyDigits(order.client_phone) === digits)
    .flatMap((order) => order.installments_list)
    .filter((parcel) => !parcel.merged_into_order_id && remainingCents(parcel) > 0)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.number - b.number);
}

export type UnificationPlan = {
  previousCents: number;
  newCents: number;
  totalCents: number;
  sources: { id: string; remainingCents: number }[];
  parcels: { number: number; amountCents: number; dueDate: string | null }[];
};

export function unificationPlan(sources: StoreOrderInstallment[], newCents: number, count: number, firstDue: string | null, offset = 0): UnificationPlan {
  const n = Math.max(1, Math.floor(count));
  const previousCents = sources.reduce((sum, p) => sum + remainingCents(p), 0);
  const totalCents = previousCents + newCents;
  const base = Math.floor(totalCents / n);
  const remainder = totalCents % n;
  return {
    previousCents, newCents, totalCents,
    sources: sources.map((p) => ({ id: p.id, remainingCents: remainingCents(p) })),
    parcels: Array.from({ length: n }, (_, i) => ({ number: offset + i + 1, amountCents: base + (i < remainder ? 1 : 0), dueDate: firstDue ? addMonthsISO(firstDue, i) : null })),
  };
}