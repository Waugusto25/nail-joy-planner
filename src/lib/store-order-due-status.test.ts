import assert from "node:assert/strict";
import { test } from "node:test";
import { storeOrderDueState } from "./store-order-due-status";

test("an unpaid installment before today is overdue", () => {
  assert.equal(storeOrderDueState(false, "2026-10-30", new Date("2026-10-31T05:09:00Z")), "overdue");
});

test("an installment due today is not overdue", () => {
  assert.equal(storeOrderDueState(false, "2026-10-31", new Date("2026-10-31T05:09:00Z")), "upcoming");
});

test("a future installment is upcoming", () => {
  assert.equal(storeOrderDueState(false, "2026-11-01", new Date("2026-10-31T05:09:00Z")), "upcoming");
});

test("all installments paid overrides an old due date", () => {
  assert.equal(storeOrderDueState(true, "2026-10-01"), "paid");
});

test("unpaid installments without a due date must not appear paid", () => {
  assert.equal(storeOrderDueState(false, null), "undated");
});

test("UTC midnight does not advance the Sao Paulo due date", () => {
  assert.equal(storeOrderDueState(false, "2026-10-30", new Date("2026-10-31T02:59:59Z")), "upcoming");
  assert.equal(storeOrderDueState(false, "2026-10-30", new Date("2026-10-31T03:00:00Z")), "overdue");
});