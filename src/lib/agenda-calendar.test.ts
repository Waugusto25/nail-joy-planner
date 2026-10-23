import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMonthGrid, groupByDay, shiftMonth } from "./agenda-calendar";

test("outubro/2026 começa na quinta e tem 42 células", () => {
  const grid = buildMonthGrid(2026, 10);
  assert.equal(grid.length, 42);
  assert.equal(grid[0]?.iso, "2026-09-27");
  assert.deepEqual(grid[4], { iso: "2026-10-01", day: 1, inMonth: true });
});

test("vira o ano ao avançar dezembro", () => {
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
});

test("ordena clientes do dia por horário", () => {
  const map = groupByDay([
    { day: "2026-10-23", start_time: "14:00" },
    { day: "2026-10-23", start_time: "09:00" },
  ]);
  assert.deepEqual(map.get("2026-10-23")?.map((a) => a.start_time), ["09:00", "14:00"]);
});
