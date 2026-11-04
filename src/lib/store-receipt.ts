import { formatPrice } from "./salon";

export type ReceiptPayment = { amountCents?: number | undefined; remainingCents?: number | undefined; accountRemainingCents?: number | undefined; partial?: boolean | undefined };

/** The outbox carries this payment's delta, not the accumulated paid amount. */
export function receiptPaymentDetails(payment: ReceiptPayment): { receivedCents: number; remainingCents: number; partial: boolean } {
  const receivedCents = Math.max(0, payment.amountCents ?? 0);
  const remainingCents = Math.max(0, payment.remainingCents ?? 0);
  return { receivedCents, remainingCents, partial: payment.remainingCents === undefined ? Boolean(payment.partial) : remainingCents > 0 };
}

/** Missing balance on older queued receipts must never imply full settlement. */
export function receiptSettlementState(payment: ReceiptPayment): "partial" | "installment" | "account" {
  if (receiptPaymentDetails(payment).partial) return "partial";
  return payment.accountRemainingCents === 0 ? "account" : "installment";
}

export function storeReceiptMessage(payment: ReceiptPayment & { number?: number | undefined }): string {
  const receipt = receiptPaymentDetails(payment);
  const value = formatPrice(receipt.receivedCents);
  switch (receiptSettlementState(payment)) {
    case "partial": return `Olá! Seu pagamento parcial de ${value} referente à parcela ${payment.number} foi confirmado. Valor restante: ${formatPrice(receipt.remainingCents)}. Obrigada! 🛍️✨`;
    case "account": return `Olá! Seu pagamento de ${value} referente à parcela ${payment.number} foi confirmado. Sua conta está 100% quitada! Obrigada! 🛍️✨`;
    case "installment": return `Olá! Seu pagamento de ${value} referente à parcela ${payment.number} deste mês foi confirmado com sucesso. Obrigada! 🛍️✨`;
  }
}