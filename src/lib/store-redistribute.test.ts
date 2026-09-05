import { expect, test } from "vitest";
import { redistributeInstallments, type StoreOrderWithDetails } from "@/lib/store";

function parcel(n: number, amount: number, paid: boolean, due: string) {
  return { id: `p${n}`, order_id: "o", number: n, amount_cents: amount, due_date: due, paid_at: paid ? "2026-09-01T12:00:00Z" : null, merged_into_order_id: null, merged_extra_cents: 0 };
}
const order = {
  id: "o", store_client_id: "c", created_at: null, client_name: "X", client_phone: "", nickname: null,
  item_name: "a", amount_cents: 30000, payment_method: "pix", installments: 3, delivery_date: "2026-09-05",
  status: "encomendado", notes: null, items: [{ id: "i1", order_id: "o", name: "a", unit_price_cents: 30000, sort_order: 0 }],
  installments_list: [parcel(1, 10000, true, "2026-09-05"), parcel(2, 10000, false, "2026-10-05"), parcel(3, 10000, false, "2026-11-05")],
} as StoreOrderWithDetails;

test("keep", () => {
  const p = redistributeInstallments(order, 5001, "keep", 1);
  expect(p.pendingBalanceCents).toBe(25001);
  expect(p.update.map((u) => u.amount_cents)).toEqual([12501, 12500]);
  expect(p.update.map((u) => u.due_date)).toEqual(["2026-10-05", "2026-11-05"]);
  expect(p.insert).toEqual([]);
  expect(p.totalInstallments).toBe(3);
});

test("resplit em 3", () => {
  const p = redistributeInstallments(order, 5000, "resplit", 3);
  expect(p.update.length).toBe(2);
  expect(p.insert.length).toBe(1);
  expect(p.insert[0].number).toBe(4);
  expect(p.update[0].due_date).toBe("2026-10-05");
  expect(p.insert[0].due_date).toBe("2026-12-05");
  expect(p.update.reduce((s,u)=>s+u.amount_cents,0)+p.insert[0].amount_cents).toBe(25000);
  expect(p.totalInstallments).toBe(4);
});

test("resplit em 1 remove sobra", () => {
  const p = redistributeInstallments(order, 0, "resplit", 1);
  expect(p.update.length).toBe(1);
  expect(p.update[0].amount_cents).toBe(20000);
  expect(p.remove).toEqual(["p3"]);
  expect(p.totalInstallments).toBe(2);
});

test("tudo pago cria parcela nova", () => {
  const allPaid = { ...order, installments_list: [parcel(1, 30000, true, "2026-09-05")] } as StoreOrderWithDetails;
  const p = redistributeInstallments(allPaid, 8000, "keep", 1);
  expect(p.update).toEqual([]);
  expect(p.insert).toEqual([{ number: 2, amount_cents: 8000, due_date: "2026-09-05" }]);
});
