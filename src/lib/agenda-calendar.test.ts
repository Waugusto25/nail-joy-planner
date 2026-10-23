import { describe, expect, it } from "vitest";
import { buildMonthGrid, groupByDay, shiftMonth } from "./agenda-calendar";

describe("agenda-calendar", () => {
  it("outubro/2026 começa na quinta e tem 42 células", () => {
    const grid = buildMonthGrid(2026, 10);
    expect(grid).toHaveLength(42);
    expect(grid[0].iso).toBe("2026-09-27");
    expect(grid[4]).toEqual({ iso: "2026-10-01", day: 1, inMonth: true });
  });

  it("vira o ano ao avançar dezembro", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("ordena clientes do dia por horário", () => {
    const map = groupByDay([
      { day: "2026-10-23", start_time: "14:00" },
      { day: "2026-10-23", start_time: "09:00" },
    ]);
    expect(map.get("2026-10-23")?.map((a) => a.start_time)).toEqual(["09:00", "14:00"]);
  });
});
