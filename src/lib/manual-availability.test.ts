import assert from "node:assert/strict";
import { test } from "node:test";
import { manualAvailableTimes, manualTimeConflict, type ManualSchedule } from "./manual-availability";

const schedule: ManualSchedule = {
  slots: [{ weekday: 5, start_time: "09:00:00" }, { weekday: 5, start_time: "10:00:00" }, { weekday: 5, start_time: "11:00:00" }],
  breaks: [{ weekday: 5, start_time: "12:00", end_time: "13:00" }],
  blocked: [], special: [], monthActive: true,
  busy: [{ day: "2026-10-23", start_time: "10:00", duration: 60 }],
};

test("vaga considera a duração completa do procedimento e libera a hora de término", () => {
  assert.deepEqual(manualAvailableTimes(schedule, "2026-10-23", 60, "2026-10-22", 0), ["09:00", "11:00"]);
  assert.deepEqual(manualAvailableTimes(schedule, "2026-10-23", 120, "2026-10-22", 0), []);
});
test("data bloqueada não oferece vagas regulares", () => {
  assert.deepEqual(manualAvailableTimes({ ...schedule, blocked: ["2026-10-23"] }, "2026-10-23", 60, "2026-10-22", 0), []);
});
test("dia especial libera horário fora do expediente em data bloqueada", () => {
  const special = { ...schedule, blocked: ["2026-10-23"], special: [{ day: "2026-10-23", times: ["18:00:00"] }] };
  assert.deepEqual(manualAvailableTimes(special, "2026-10-23", 60, "2026-10-22", 0), ["18:00"]);
});
test("atendimento especial não permite sobreposição", () => {
  assert.equal(manualTimeConflict(schedule, "2026-10-23", "10:30", 60), true);
  assert.equal(manualTimeConflict(schedule, "2026-10-23", "18:00", 60), false);
});
test("mês fechado não oferece vagas regulares", () => {
  assert.deepEqual(manualAvailableTimes({ ...schedule, monthActive: false }, "2026-10-23", 60, "2026-10-22", 0), []);
});
test("dia atual respeita a antecedência e não oferece horários passados", () => {
  assert.deepEqual(manualAvailableTimes(schedule, "2026-10-23", 60, "2026-10-23", 570), ["11:00"]);
});
test("atendimento não atravessa a meia-noite", () => {
  assert.equal(manualTimeConflict(schedule, "2026-10-23", "23:30", 60), true);
});