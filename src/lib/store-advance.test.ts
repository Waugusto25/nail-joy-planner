import { describe, expect, it } from "vitest";
import { advancedCents, receivedCents, remainingCents, validateAdvance, saoPauloToday } from "./store-advance";

const first = { id: "first", amount_cents: 5000, paid_on: "2026-11-01", created_at: "2026-11-01T15:00:00Z" };
const parcel = { amount_cents: 10000, paid_amount_cents: 5000, paid_at: null, advances: [first] };

describe("adiantamentos na própria parcela", () => {
  it("mantém 50 restantes de 100 após adiantar metade", () => {
    expect(remainingCents(parcel)).toBe(5000);
    expect(receivedCents(parcel)).toBe(5000);
    expect(parcel.paid_at).toBeNull();
  });
  it("soma adiantamentos separados sem duplicar recebimento na quitação", () => {
    const paid = { ...parcel, advances: [first, { ...first, id: "second", amount_cents: 2500 }], paid_at: "2026-11-10", paid_amount_cents: 10000 };
    expect(advancedCents(paid)).toBe(7500);
    expect(receivedCents(paid)).toBe(10000);
    expect(remainingCents(paid)).toBe(0);
  });
  it("recusa valor acima do restante", () => {
    expect(validateAdvance(parcel, 5001)).toBe(false);
    expect(validateAdvance(parcel, 5000)).toBe(true);
  });
  it("recusa zero, negativo e parcela quitada", () => {
    expect(validateAdvance(parcel, 0)).toBe(false);
    expect(validateAdvance(parcel, -1)).toBe(false);
    expect(validateAdvance({ ...parcel, paid_at: "2026-11-10" }, 1)).toBe(false);
  });
  it("ignora resíduo legado sem histórico explícito", () => {
    expect(remainingCents({ ...parcel, advances: [] })).toBe(10000);
  });
  it("usa a data brasileira na virada UTC", () => {
    expect(saoPauloToday(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10-31");
  });
});