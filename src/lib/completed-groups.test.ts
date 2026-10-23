import assert from "node:assert/strict";
import { test } from "node:test";
import { groupCompletedAppointments } from "./completed-groups";

const row = (id: string, client: string, day: string, start: string, cents: number, svc: string) => ({
  id, client_id: client, day, start_time: start, price_cents: cents, serviceName: svc,
});

test("soma procedimentos da mesma cliente no mesmo dia em uma linha", () => {
  const g = groupCompletedAppointments([
    row("1", "lid", "2026-10-22", "10:00", 3000, "Mão"),
    row("2", "lid", "2026-10-22", "09:00", 2000, "Pé"),
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0]?.totalCents, 5000);
  assert.equal(g[0]?.firstStart, "09:00");
  assert.deepEqual(g[0]?.serviceNames, ["Pé", "Mão"]);
});

test("separa dias diferentes e ordena do mais recente", () => {
  const g = groupCompletedAppointments([
    row("1", "lid", "2026-10-20", "09:00", 1000, "Pé"),
    row("2", "lid", "2026-10-22", "09:00", 1000, "Pé"),
  ]);
  assert.deepEqual(g.map((x) => x.day), ["2026-10-22", "2026-10-20"]);
});
