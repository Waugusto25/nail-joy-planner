import { z } from "zod";

import { phoneSchema } from "./auth-schemas";

export const updateMyAccountInput = z.object({
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .max(255, "E-mail muito longo")
    .optional()
    .transform((v) => (v ? v.toLowerCase() : ""))
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Informe um e-mail válido",
    }),
});

export const claimEventPrizeInput = z.object({
  eventId: z.string().uuid(),
  appointmentId: z.string().uuid(),
});

const emailSchema = z
  .string()
  .trim()
  .max(255, "E-mail muito longo")
  .transform((v) => v.toLowerCase())
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "Informe um e-mail válido" });

export const requestEmailChangeInput = z.object({ requestedEmail: emailSchema });

export const decideEmailChangeInput = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean(),
});
