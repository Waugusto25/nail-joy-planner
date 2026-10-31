export type StoreAdvance = {
  id: string;
  amount_cents: number;
  paid_on: string;
  created_at: string;
};

export type AdvanceParcel = {
  amount_cents: number;
  paid_amount_cents: number;
  paid_at: string | null;
  advances?: StoreAdvance[];
};

export function advancedCents(parcel: AdvanceParcel): number {
  return (parcel.advances ?? []).reduce((sum, entry) => sum + entry.amount_cents, 0);
}

/** Legacy pending rows can have stale payments: only explicit advances count. */
export function receivedCents(parcel: AdvanceParcel): number {
  return parcel.paid_at
    ? parcel.paid_amount_cents || parcel.amount_cents
    : advancedCents(parcel);
}

export function remainingCents(parcel: AdvanceParcel): number {
  return Math.max(0, parcel.amount_cents - receivedCents(parcel));
}

export function validateAdvance(parcel: AdvanceParcel, amount: number): boolean {
  return !parcel.paid_at && Number.isSafeInteger(amount) && amount > 0 && amount <= remainingCents(parcel);
}

export function saoPauloToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (key: string) => parts.find((part) => part.type === key)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}