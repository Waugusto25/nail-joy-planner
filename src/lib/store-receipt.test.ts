import assert from "node:assert/strict";
import { test } from "node:test";
import { receiptPaymentDetails } from "./store-receipt";

test("partial receipt reports the current payment and remaining balance even with a settlement flag", () => {
  assert.deepEqual(receiptPaymentDetails({ amountCents: 5000, remainingCents: 12881, partial: false }), { receivedCents: 5000, remainingCents: 12881, partial: true });
});
test("paying the remaining balance reports only the second payment and no debt", () => {
  assert.deepEqual(receiptPaymentDetails({ amountCents: 12881, remainingCents: 0, partial: true }), { receivedCents: 12881, remainingCents: 0, partial: false });
});
test("overpayment never reports a negative remaining balance", () => {
  assert.deepEqual(receiptPaymentDetails({ amountCents: 18000, remainingCents: -119 }), { receivedCents: 18000, remainingCents: 0, partial: false });
});