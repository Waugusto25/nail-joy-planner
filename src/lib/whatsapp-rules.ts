import { z } from "zod";

export const whatsappConfigSchema = z.object({
  api_url: z.string().url().max(500).refine((s) => new URL(s).protocol === "https:", "Use HTTPS para proteger a chave e as mensagens."),
  instance_name: z.string().trim().min(1).max(80).regex(/^[\w-]+$/),
  enabled: z.boolean(),
});

export function whatsappPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const national = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (!/^\d{10,11}$/.test(national)) throw new Error("Telefone inválido.");
  return `55${national}`;
}

export function reminderDates(now: Date): { salonDay: string; storeDueDay: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const d = new Date(`${today}T12:00:00Z`);
  return { salonDay: new Date(d.getTime() + 86400000).toISOString().slice(0, 10), storeDueDay: new Date(d.getTime() - 86400000).toISOString().slice(0, 10) };
}