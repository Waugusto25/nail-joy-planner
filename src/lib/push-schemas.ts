import { z } from "zod";

/** Chave pública VAPID (pode ficar no código — é pública por definição). */
export const VAPID_PUBLIC_KEY =
  "BCry3MVVR3w-aRlKIEDdt6aeTYN-4swkuBmE6I7AMWwvsaJCT0ZCqqvTm4BL4IE-XdlEJil2SDO6av8RuGZfUwU";

export const subscriptionInput = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(10).max(300),
  auth: z.string().min(5).max(300),
  userAgent: z.string().max(400).optional(),
});

export const endpointInput = z.object({
  endpoint: z.string().url().max(1000),
});

export const appointmentIdOnly = z.object({
  appointmentId: z.string().uuid(),
});
