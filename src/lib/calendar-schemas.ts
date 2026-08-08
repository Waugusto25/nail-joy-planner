import { z } from "zod";

export const appointmentIdInput = z.object({ appointmentId: z.string().uuid() });
