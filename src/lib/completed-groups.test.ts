import { describe, expect, it } from "vitest";
import { groupCompletedAppointments } from "./completed-groups";

const row = (id: string, client: string, day: string, start: string, cents: number, svc: string) => ({
  id, client_id: client, day, start_time: start, price_cents: cents, serviceName: svc,
});

describe("groupCompletedAppointments", () => {
  it("soma procedimentos da mesma cliente no mesmo dia em uma linha", () => {
    const g = groupCompletedAppointments([
      row("1", "lid", "2026-10-22", "10:00", 3000, "Mão"),
      row("2", "lid", "2026-10-22", "09:00", 2000, "Pé"),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].totalCents).toBe(5000);
    expect(g[0].firstStart).toBe("09:00");
    expect(g[0].serviceNames).toEqual(["Pé", "Mão"]);
  });

  it("separa dias diferentes e ordena do mais recente", () => {
    const g = groupCompletedAppointments([
      row("1", "lid", "2026-10-20", "09:00", 1000, "Pé"),
      row("2", "lid", "2026-10-22", "09:00", 1000, "Pé"),
    ]);
    expect(g.map((x) => x.day)).toEqual(["2026-10-22", "2026-10-20"]);
  });
});
