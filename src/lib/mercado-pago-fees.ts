// Taxa de emissão de boleto repassada à cliente. Pix não tem taxa.
// Fica num módulo único para que a cobrança, a tela e o PDF usem o mesmo valor.
export const BOLETO_FEE_CENTS = 349;

export type MpChargeMethod = "pix" | "boleto";

export function chargeFeeCents(method: MpChargeMethod): number {
  return method === "boleto" ? BOLETO_FEE_CENTS : 0;
}

export const BOLETO_FEE_NOTICE =
  "Valor acrescido de R$ 3,49 referente à taxa de emissão de boleto bancário bancada pelo cliente. Para evitar taxas, solicite o pagamento via Pix normal.";

/** Prazo fixo do boleto: 3 dias corridos a partir de hoje (fuso de São Paulo). */
export const BOLETO_DAYS_TO_EXPIRE = 3;

/** Data de vencimento do boleto em YYYY-MM-DD, calculada no fuso America/Sao_Paulo. */
export function boletoExpiryISO(now: Date = new Date()): string {
  // en-CA formata como YYYY-MM-DD; o fuso garante o "hoje" brasileiro mesmo no servidor UTC.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  const [y = 1970, m = 1, d = 1] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + BOLETO_DAYS_TO_EXPIRE));
  return date.toISOString().slice(0, 10);
}
