import { describe, expect, it } from "vitest";
import { groupUpcomingByMonth } from "./special-days-grouping";

describe("groupUpcomingByMonth", () => {
  it("oculta datas passadas e mantém o dia de hoje", () => {
    const g = groupUpcomingByMonth([{ day: "2026-10-22" }, { day: "2026-10-23" }], "2026-10-23");
    expect(g.flatMap((x) => x.rows.map((r) => r.day))).toEqual(["2026-10-23"]);
  });
  it("agrupa por mês em ordem", () => {
    const g = groupUpcomingByMonth(
      [{ day: "2026-12-01" }, { day: "2026-11-05" }, { day: "2026-11-02" }],
      "2026-10-01",
    );
    expect(g.map((x) => x.label)).toEqual(["Novembro 2026", "Dezembro 2026"]);
    expect(g[0].rows.map((r) => r.day)).toEqual(["2026-11-02", "2026-11-05"]);
  });
});
