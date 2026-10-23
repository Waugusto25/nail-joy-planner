import assert from "node:assert/strict";
import { test } from "node:test";
import { canChangeScheduleMonth, scheduleCalendarMonths, scheduleCalendarYears, scheduleCurrentMonth } from "./schedule-month-calendar";

test("calendário mostra exatamente 12 meses de 2026", () => {
  const months = scheduleCalendarMonths(2026, "2026-10");
  assert.equal(months.length, 12);
  assert.equal(months[0]?.key, "2026-01");
  assert.equal(months[11]?.key, "2026-12");
});
test("meses passados ficam bloqueados e outubro atual pode ser alterado", () => {
  assert.equal(canChangeScheduleMonth("2026-09", "2026-10"), false);
  assert.equal(canChangeScheduleMonth("2026-10", "2026-10"), true);
  assert.equal(canChangeScheduleMonth("2026-11", "2026-10"), true);
  assert.equal(canChangeScheduleMonth("2026-12", "2026-10"), true);
});
test("somente 2026 e 2027 disponíveis, incluindo dezembro de 2027", () => {
  assert.deepEqual(scheduleCalendarYears("2026-10"), [2026, 2027]);
  assert.equal(canChangeScheduleMonth("2027-12", "2026-10"), true);
  assert.equal(canChangeScheduleMonth("2028-01", "2026-10"), false);
});
test("virada abre 2028 e fecha 2026", () => {
  assert.deepEqual(scheduleCalendarYears("2027-01"), [2027, 2028]);
  assert.equal(canChangeScheduleMonth("2026-12", "2027-01"), false);
  assert.equal(canChangeScheduleMonth("2028-12", "2027-01"), true);
});
test("ano muda à meia-noite em Brasília e não em UTC", () => {
  assert.equal(scheduleCurrentMonth(new Date("2027-01-01T02:59:59Z")), "2026-12");
  assert.equal(scheduleCurrentMonth(new Date("2027-01-01T03:00:00Z")), "2027-01");
});