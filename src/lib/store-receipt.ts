export type ReceiptPayment = { amountCents?: number | undefined; remainingCents?: number | undefined; partial?: boolean | undefined };

/** The outbox carries this payment's delta, not the accumulated paid amount. */
export function receiptPaymentDetails(payment: ReceiptPayment): { receivedCents: number; remainingCents: number; partial: boolean } {
  const receivedCents = Math.max(0, payment.amountCents ?? 0);
  const remainingCents = Math.max(0, payment.remainingCents ?? 0);
  return { receivedCents, remainingCents, partial: payment.remainingCents === undefined ? Boolean(payment.partial) : remainingCents > 0 };
}