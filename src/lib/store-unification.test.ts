import { describe, expect, it } from "vitest";
import { unificationPlan, unificationSources } from "./store-unification";
import type { StoreOrderInstallment, StoreOrderWithDetails } from "./store";

const parcel = (number: number, amount: number): StoreOrderInstallment => ({ id: String(number), order_id: "old", number, amount_cents: amount, due_date: "2026-11-30", paid_at: null, paid_amount_cents: 0, credit_applied_cents: 0, carried_in_cents: 0, added_extra_cents: 0, merged_extra_cents: 0, merged_into_order_id: null });
describe("unificação de todas as parcelas", () => {
  it("Marry: 129,90 + 172,80 soma 302,70 distribuídos em quatro parcelas", () => {
    const plan = unificationPlan([parcel(1, 3247), parcel(2, 3247), parcel(3, 3247), parcel(4, 3249)], 17280, 4, "2026-11-30");
    expect(plan.previousCents).toBe(12990);
    expect(plan.parcels.map((p) => p.amountCents)).toEqual([7568, 7568, 7567, 7567]);
    expect(plan.parcels.reduce((s, p) => s + p.amountCents, 0)).toBe(30270);
    expect(plan.sources).toHaveLength(4);
    expect(plan.parcels.map((p) => p.dueDate)).toEqual(["2026-11-30", "2026-12-30", "2027-01-30", "2027-02-28"]);
  });
  it("transfere somente saldo após adiantamento de 50 em parcela de 100", () => {
    expect(unificationPlan([{ ...parcel(1, 10000), paid_amount_cents: 5000, advances: [{ id: "advance", amount_cents: 5000, paid_on: "2026-11-01", created_at: "2026-11-01" }] }], 10000, 2, null).totalCents).toBe(15000);
  });
  it("exclui quitadas, transferidas e clientes diferentes, inclui parcial", () => {
    const order = { id: "old", store_client_id: "client", installments_list: [parcel(1, 10000), { ...parcel(2, 10000), paid_at: "2026-11-01", paid_amount_cents: 10000 }, { ...parcel(3, 10000), merged_into_order_id: "new" }, { ...parcel(4, 10000), paid_at: "2026-11-01", paid_amount_cents: 2500 }] } as StoreOrderWithDetails;
    expect(unificationSources([order, { ...order, store_client_id: "other" }], "client", "").map((p) => p.id)).toEqual(["1", "4"]);
    expect(unificationPlan(unificationSources([order], "client", ""), 0, 2, null).previousCents).toBe(17500);
  });
});