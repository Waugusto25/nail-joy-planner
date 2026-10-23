import { describe, expect, it } from "vitest";

import { findDelayConflicts, newPriceCents } from "./service-change";

describe("troca de procedimento", () => {
  it("procedimento mais longo que invade o próximo gera aviso de atraso", () => {
    const c = findDelayConflicts("16:30", 120, [
      { start_time: "18:00:00", duration_minutes: 60, client_name: "Juliana" },
    ]);
    expect(c).toEqual([{ clientName: "Juliana", startTime: "18:00", overlapMinutes: 30 }]);
  });

  it("procedimento mais curto não gera aviso", () => {
    expect(
      findDelayConflicts("16:30", 60, [{ start_time: "18:00:00", duration_minutes: 60 }]),
    ).toEqual([]);
  });

  it("mantém o desconto percentual no novo valor", () => {
    expect(newPriceCents(5000, 50)).toBe(2500);
    expect(newPriceCents(2500, 0)).toBe(2500);
  });
});
