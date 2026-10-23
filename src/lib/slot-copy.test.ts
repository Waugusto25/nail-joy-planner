import assert from "node:assert/strict";
import { test } from "node:test";
import { planSlotCopy } from "./slot-copy";

const rows = [
  { id: "a", weekday: 1, start_time: "08:00:00" },
  { id: "b", weekday: 1, start_time: "09:00:00" },
  { id: "c", weekday: 2, start_time: "09:00:00" },
  { id: "d", weekday: 2, start_time: "15:00:00" },
];

test("substituir apaga horários extras do destino e adiciona os faltantes", () => {
  const plan = planSlotCopy(rows, 1, [2], "replace");
  assert.deepEqual(plan.deleteIds, ["d"]);
  assert.deepEqual(plan.inserts, [{ weekday: 2, start_time: "08:00:00" }]);
});

test("mesclar mantém horários do destino e não duplica", () => {
  const plan = planSlotCopy(rows, 1, [2, 3], "merge");
  assert.deepEqual(plan.deleteIds, []);
  assert.deepEqual(plan.inserts, [
    { weekday: 2, start_time: "08:00:00" },
    { weekday: 3, start_time: "08:00:00" },
    { weekday: 3, start_time: "09:00:00" },
  ]);
});
