import assert from "node:assert/strict";
import { test } from "node:test";
import { receiptPaymentDetails, receiptSettlementState } from "./store-receipt";

test("Wellington's first installment of 57.98 with 7.98 received leaves 50.00 open", () => {
  assert.deepEqual(receiptPaymentDetails({ amountCents: 798, remainingCents: 5798 - 798, partial: true }), { receivedCents: 798, remainingCents: 5000, partial: true });
});

test("partial receipt reports the current payment and remaining balance even with a settlement flag", () => {
  assert.deepEqual(receiptPaymentDetails({ amountCents: 5000, remainingCents: 12881, partial: false }), { receivedCents: 5000, remainingCents: 12881, partial: true });
});
test("paying the remaining balance reports only the second payment and no debt", () => {
  assert.deepEqual(receiptPaymentDetails({ amountCents: 12881, remainingCents: 0, partial: true }), { receivedCents: 12881, remainingCents: 0, partial: false });
});
test("overpayment never reports a negative remaining balance", () => {
  assert.deepEqual(receiptPaymentDetails({ amountCents: 18000, remainingCents: -119 }), { receivedCents: 18000, remainingCents: 0, partial: false });
});

test("Maria paying installment 3 of 110.61 with 33.33 still owed is not account settlement", () => {
  assert.equal(receiptSettlementState({ amountCents: 11061, remainingCents: 0, accountRemainingCents: 3333 }), "installment");
});
test("only zero remaining account balance allows total settlement", () => {
  assert.equal(receiptSettlementState({ amountCents: 3333, remainingCents: 0, accountRemainingCents: 0 }), "account");
});
test("older queued receipts without account balance never imply total settlement", () => {
  assert.equal(receiptSettlementState({ amountCents: 11061, remainingCents: 0 }), "installment");
});
test("partial payment of 7.98 leaving 50.00 remains partial even with inconsistent account balance", () => {
  assert.equal(receiptSettlementState({ amountCents: 798, remainingCents: 5000, accountRemainingCents: 0 }), "partial");
});