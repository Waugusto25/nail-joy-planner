export type CalendarMonth = { key: string; name: string; past: boolean };

const names = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"] as const;

/** Brasília avoids changing the booking year at UTC midnight. */
export function scheduleCurrentMonth(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

export function scheduleCalendarYears(currentMonth: string): [number, number] {
  const year = Number(currentMonth.slice(0, 4));
  return [year, year + 1];
}

export function scheduleCalendarMonths(year: number, currentMonth: string): CalendarMonth[] {
  return names.map((name, index) => {
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;
    return { key, name, past: key < currentMonth };
  });
}

export function canChangeScheduleMonth(key: string, currentMonth: string): boolean {
  const years = scheduleCalendarYears(currentMonth);
  return years.includes(Number(key.slice(0, 4))) &&
    scheduleCalendarMonths(Number(key.slice(0, 4)), currentMonth).some((month) => month.key === key && !month.past);
}