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
  .min(3, "Informe seu nome completo")
  .max(80, "Nome muito longo")
  .refine((v) => v.includes(" "), { message: "Informe nome e sobrenome" });

export const identifierSchema = z.string().trim().min(3, "Informe seu nome ou ID de login").max(80);

export const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "O código tem 4 dígitos");

export const startSignupInput = z.object({ fullName: nameSchema, phone: phoneSchema });
export const finishSignupInput = z.object({
  fullName: nameSchema,
  phone: phoneSchema,
  code: codeSchema,
});
export const resolveLoginInput = z.object({ identifier: identifierSchema });
export const startRecoveryInput = z.object({ identifier: identifierSchema });
export const finishRecoveryInput = z.object({
  identifier: identifierSchema,
  code: codeSchema,
  phone: phoneSchema,
});
export const adminUpdateClientInput = z.object({
  clientId: z.string().uuid(),
  phone: phoneSchema,
});