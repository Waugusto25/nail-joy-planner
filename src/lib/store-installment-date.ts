import { saoPauloToday } from "@/lib/store-advance";

type InstallmentDates = { paid_at: string | null; due_date: string | null };

export type InstallmentDateField = {
  kind: "payment" | "due";
  value: string;
  readOnly: boolean;
};

/** The payment timestamp is history; the original due date remains available after reversal. */
export function installmentDateField(parcel: InstallmentDates): InstallmentDateField {
  if (parcel.paid_at) {
    const paidAt = new Date(parcel.paid_at);
    return {
      kind: "payment",
      value: Number.isNaN(paidAt.getTime()) ? "" : saoPauloToday(paidAt),
      readOnly: true,
    };
  }
  return { kind: "due", value: parcel.due_date ?? "", readOnly: false };
}