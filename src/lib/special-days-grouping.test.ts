import assert from "node:assert/strict";
import { test } from "node:test";
import { groupUpcomingByMonth } from "./special-days-grouping";

test("oculta datas passadas e mantém o dia de hoje", () => {
  const g = groupUpcomingByMonth([{ day: "2026-10-22" }, { day: "2026-10-23" }], "2026-10-23");
  assert.deepEqual(g.flatMap((x) => x.rows.map((r) => r.day)), ["2026-10-23"]);
});

test("agrupa por mês em ordem", () => {
  const g = groupUpcomingByMonth(
    [{ day: "2026-12-01" }, { day: "2026-11-05" }, { day: "2026-11-02" }],
    "2026-10-01",
  );
  assert.deepEqual(g.map((x) => x.label), ["Novembro 2026", "Dezembro 2026"]);
  assert.deepEqual(g[0]?.rows.map((r) => r.day), ["2026-11-02", "2026-11-05"]);
});
