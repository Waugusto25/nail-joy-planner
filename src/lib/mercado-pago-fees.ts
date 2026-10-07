// Taxa de emissão de boleto repassada à cliente. Pix não tem taxa.
// Fica num módulo único para que a cobrança, a tela e o PDF usem o mesmo valor.
export const BOLETO_FEE_CENTS = 349;

export type MpChargeMethod = "pix" | "boleto";

export function chargeFeeCents(method: MpChargeMethod): number {
  return method === "boleto" ? BOLETO_FEE_CENTS : 0;
}

export const BOLETO_FEE_NOTICE =
  "Valor acrescido de R$ 3,49 referente à taxa de emissão de boleto bancário bancada pelo cliente. Para evitar taxas, solicite o pagamento via Pix normal.";
