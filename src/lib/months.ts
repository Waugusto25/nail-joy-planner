/** Utilidades de navegação multimeses da agenda (chave "YYYY-MM"). */

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

/** Mês de uma data ISO (YYYY-MM-DD) → "YYYY-MM". */
export function monthKeyOf(day: string) {
  return day.slice(0, 7);
}

/** Mês atual no fuso do dispositivo. */
export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Rótulo amigável: "Setembro 2026". */
export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`;
}

/** Rótulo curto: "Set/26". */
export function monthShortLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]?.slice(0, 3)}/${String(y).slice(2)}`;
}

/** Sequência de meses a partir do mês atual (inclusive). */
export function monthKeysFrom(count: number, startKey = currentMonthKey()) {
  const [y, m] = startKey.split("-").map(Number);
  const list: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(y!, (m ?? 1) - 1 + i, 1);
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return list;
}

/** Último dia (ISO) de um mês "YYYY-MM". */
export function lastDayOfMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y!, m ?? 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Todos os dias ISO de hoje até o fim do mês informado. */
export function daysUntilEndOfMonth(fromISO: string, monthKey: string) {
  const end = lastDayOfMonth(monthKey);
  const [y, m, d] = fromISO.split("-").map(Number);
  const list: string[] = [];
  const cursor = new Date(y!, (m ?? 1) - 1, d ?? 1);
  for (let i = 0; i < 400; i++) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (iso > end) break;
    list.push(iso);
    cursor.setDate(cursor.getDate() + 1);
  }
  return list;
}
