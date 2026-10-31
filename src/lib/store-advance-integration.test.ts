import { describe, it, expect } from "vitest";
import { settleInstallment, type StoreOrderInstallment, type StoreOrderWithDetails } from "./store";
import { computeReport } from "./store-general-report";
import { statementTotals } from "./store-statement";

const parcel: StoreOrderInstallment = {
  id: "one", order_id: "order", number: 1, amount_cents: 10000,
  paid_amount_cents: 5000, due_date: "2026-11-10", paid_at: null,
  merged_into_order_id: null, merged_extra_cents: 0, added_extra_cents: 0,
  credit_applied_cents: 0, carried_in_cents: 0,
  advances: [{ id: "advance", amount_cents: 5000, paid_on: "2026-11-01", created_at: "2026-11-01T15:00:00Z" }],
};
const next = { ...parcel, id: "two", number: 2, due_date: "2026-12-10", paid_amount_cents: 0, advances: [] };
const order: StoreOrderWithDetails = {
  id: "order", store_client_id: null, created_at: "2026-10-31T12:00:00Z", archived_at: null,
  client_name: "Teste", client_phone: "", nickname: null, item_name: "Produto", amount_cents: 20000,
  payment_method: "pix", installments: 2, delivery_date: null, delivered_on: null,
  status: "pendente", notes: null, items: [], installments_list: [parcel, next],
};

describe("integração do adiantamento", () => {
  it("baixa de 50 após adiantar 50 quita 100 sem transferir falta", () => {
    const result = settleInstallment(order, parcel, 5000, "2026-11-10");
    expect(result.target.paid_amount_cents).toBe(10000);
    expect(result.shortfallCents).toBe(0);
    expect(result.creditCents).toBe(0);
    expect(result.nextUpdate).toBeNull();
    expect(result.insert).toBeNull();
    expect(next.amount_cents).toBe(10000);
  });
  it("extrato soma adiantado como pago e deixa 50 neste mês e 100 no seguinte", () => {
    expect(statementTotals([order])).toEqual({ totalCents: 20000, paidCents: 5000, pendingCents: 15000 });
  });
  it("relatório de novembro conta adiantamento em 01/11 e saldo de 10/11", () => {
    const report = computeReport([order], { from: "2026-11-01", to: "2026-11-30" });
    expect(report.paid).toBe(5000);
    expect(report.pending).toBe(5000);
  });
  it("relatório após quitação não conta o mesmo adiantamento duas vezes", () => {
    const paid = { ...order, installments_list: [{ ...parcel, paid_at: "2026-11-10T15:00:00Z", paid_amount_cents: 10000 }, next] };
    expect(computeReport([paid], { from: "2026-11-01", to: "2026-11-30" }).paid).toBe(10000);
    expect(computeReport([paid], { from: "2026-11-10", to: "2026-11-10" }).paid).toBe(5000);
  });
});