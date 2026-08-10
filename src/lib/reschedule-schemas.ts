import { z } from "zod";

const dayField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const timeField = z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido");

export const requestRescheduleInput = z.object({
  appointmentId: z.string().uuid(),
  day: dayField,
  startTime: timeField,
  reason: z.string().trim().min(5, "Conte o motivo com pelo menos 5 caracteres").max(500),
});

export const decideRescheduleInput = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean(),
});

export const adminRescheduleInput = z.object({
  appointmentId: z.string().uuid(),
  day: dayField,
  startTime: timeField,
});
