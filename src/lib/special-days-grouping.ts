/** Agrupamento puro dos dias especiais por mês, ocultando datas já concluídas. */
export type DatedRow = { day: string };

export type MonthGroup<T extends DatedRow> = { month: string; label: string; rows: T[] };

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Datas anteriores a hoje (YYYY-MM-DD) já foram concluídas. */
export function isPastDay(day: string, todayISO: string): boolean {
  return day < todayISO;
}

export function groupUpcomingByMonth<T extends DatedRow>(rows: T[], todayISO: string): MonthGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const row of [...rows].sort((a, b) => a.day.localeCompare(b.day))) {
    if (isPastDay(row.day, todayISO)) continue;
    const month = row.day.slice(0, 7);
    map.set(month, [...(map.get(month) ?? []), row]);
  }
  return [...map.entries()].map(([month, list]) => {
    const [y, m] = month.split("-");
    return { month, label: `${MONTHS[Number(m) - 1]} ${y}`, rows: list };
  });
}
