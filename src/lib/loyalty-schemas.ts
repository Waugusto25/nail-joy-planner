import { z } from "zod";

export const PAYMENT_METHOD_VALUES = ["pix", "credito", "debito", "dinheiro"] as const;

export const completeAppointmentInput = z.object({
  appointmentId: z.string().uuid(),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
});
export const consumeReferralInput = z.object({ appointmentId: z.string().uuid() });
export const drawWinnerInput = z.object({ eventId: z.string().uuid() });

export const loyaltySpendInput = z.object({ appointmentId: z.string().uuid() });
