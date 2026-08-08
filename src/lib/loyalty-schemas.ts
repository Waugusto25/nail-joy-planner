import { z } from "zod";

export const completeAppointmentInput = z.object({ appointmentId: z.string().uuid() });
export const consumeReferralInput = z.object({ appointmentId: z.string().uuid() });
export const drawWinnerInput = z.object({ eventId: z.string().uuid() });