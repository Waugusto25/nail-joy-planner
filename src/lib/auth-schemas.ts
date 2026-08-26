import { z } from "zod";

import { onlyDigits } from "./salon";

export const phoneSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((v) => v.length >= 10 && v.length <= 13, {
    message: "Informe o telefone com DDD",
  });

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Informe seu nome")
  .max(80, "Nome muito longo");

export const identifierSchema = z.string().trim().min(3, "Informe seu nome ou ID de login").max(80);

export const phoneAccessInput = z.object({
  fullName: nameSchema,
  phone: phoneSchema,
  referrerPhone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => onlyDigits(v ?? "")),
});
export const resolveLoginInput = z.object({ identifier: identifierSchema });
export const phoneStatusInput = z.object({ phone: phoneSchema });
export const adminUpdateClientInput = z.object({
  clientId: z.string().uuid(),
  phone: phoneSchema,
});
export const adminDeleteClientInput = z.object({ clientId: z.string().uuid() });

export const finishAccessInput = z.object({
  fullName: z.string().trim().min(2).max(80),
  accessKey: z.string().uuid().optional(),
});
