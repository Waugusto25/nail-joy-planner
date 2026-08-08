import { z } from "zod";

export const cancelInput = z.object({ appointmentId: z.string().uuid() });
