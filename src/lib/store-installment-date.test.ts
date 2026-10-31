import assert from "node:assert/strict";
import { test } from "node:test";
import { installmentDateField } from "./store-installment-date";

test("pending installment keeps its editable original November 10 due date", () => {
  assert.deepEqual(installmentDateField({ paid_at: null, due_date: "2026-11-10" }), {
    kind: "due", value: "2026-11-10", readOnly: false,
  });
});

test("paid installment uses the recorded payment date instead of the due date and locks it", () => {
  assert.deepEqual(installmentDateField({ paid_at: "2026-11-01T15:00:00Z", due_date: "2026-11-10" }), {
    kind: "payment", value: "2026-11-01", readOnly: true,
  });
});

test("payment date follows Sao Paulo even before UTC's day transition reaches Brazil", () => {
  assert.equal(installmentDateField({ paid_at: "2026-11-02T02:59:59Z", due_date: null }).value, "2026-11-01");
});

test("reverting payment restores the unchanged original due date", () => {
  const parcel = { paid_at: "2026-11-01T15:00:00Z", due_date: "2026-11-10" };
  installmentDateField(parcel);
  assert.equal(parcel.due_date, "2026-11-10");
  assert.deepEqual(installmentDateField({ ...parcel, paid_at: null }), {
    kind: "due", value: "2026-11-10", readOnly: false,
  });
});

test("an advance with balance outstanding does not replace the due date", () => {
  const parcel = { paid_at: null, due_date: "2026-11-10", paid_amount_cents: 5000 };
  assert.equal(installmentDateField(parcel).kind, "due");
  assert.equal(installmentDateField(parcel).readOnly, false);
});