import { z } from "zod";

export const dayInput = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
});