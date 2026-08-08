import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
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
    .transform((v) => (v ? v.replace(/\D/g, "") : "")),
});
export const resolveLoginInput = z.object({ identifier: identifierSchema });
export const adminUpdateClientInput = z.object({
  clientId: z.string().uuid(),
  phone: phoneSchema,
});
export const adminDeleteClientInput = z.object({ clientId: z.string().uuid() });
