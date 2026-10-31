export type StoreOrderDueState = "paid" | "overdue" | "upcoming" | "undated";

/** A data civil de Brasília evita marcar atrasos pela virada do dia em UTC. */
export function storeOrderDueState(
  fullyPaid: boolean,
  dueDate: string | null,
  now: Date = new Date(),
): StoreOrderDueState {
  if (fullyPaid) return "paid";
  if (!dueDate) return "undated";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  return dueDate < today ? "overdue" : "upcoming";
}

export function compactDueDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year?.slice(-2)}`;
}