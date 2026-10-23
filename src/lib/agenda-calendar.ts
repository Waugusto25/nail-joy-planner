/**
 * Funções puras da visão "Google Agenda" do Admin.
 * Datas sempre em YYYY-MM-DD (sem Date local com fuso) para evitar deslocamento de dia.
 */

export interface CalendarCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toISO(year: number, month: number, day: number): string {
  // month 1-12; normaliza overflow via Date UTC
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Grade de 6 semanas (Dom–Sáb) para o mês informado (1-12). */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const iso = toISO(year, month, 1 - firstWeekday + i);
    cells.push({ iso, day: Number(iso.slice(8, 10)), inMonth: Number(iso.slice(5, 7)) === month });
  }
  return cells;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** Primeiro nome do nome principal; apelido não entra para manter a grade legível. */
export function firstName(fullName: string | null | undefined, fallback = "Cliente"): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || fallback;
}

/** Nome do detalhe do dia: "Maria (Sogra)" ou só "Maria". */
export function nameWithNickname(fullName: string | null | undefined, nickname: string | null | undefined): string {
  const base = firstName(fullName);
  const nick = (nickname ?? "").trim();
  return nick && nick.toLowerCase() !== base.toLowerCase() ? `${base} (${nick})` : base;
}

/** Agrupa itens por dia, ordenados por horário de início. */
export function groupByDay<T extends { day: string; start_time: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const list = map.get(it.day) ?? [];
    list.push(it);
    map.set(it.day, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
  return map;
}
