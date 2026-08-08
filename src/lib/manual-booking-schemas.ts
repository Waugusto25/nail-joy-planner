import { z } from "zod";

/** Formulário de agendamento manual criado pela administradora. */
export const manualAppointmentInput = z
  .object({
    clientId: z.string().uuid().optional(),
    clientName: z.string().trim().min(2, "Informe o nome da cliente").max(80).optional(),
    clientPhone: z
      .string()
      .trim()
      .max(20)
      .optional()
      .transform((v) => (v ? v.replace(/\D/g, "") : "")),
    serviceId: z.string().uuid("Escolha o procedimento"),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Escolha o horário"),
    paymentMethod: z.enum(["pix", "credito", "debito", "dinheiro"]).optional(),
    notes: z.string().trim().max(300).optional(),
  })
  .refine((d) => Boolean(d.clientId) || Boolean(d.clientName), {
    message: "Selecione uma cliente ou informe o nome.",
  });
