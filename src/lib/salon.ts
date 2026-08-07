export const SALON_NAME = "Jannah Nails";
export const OWNER_NAME = "Janaina Silva";
export const WHATSAPP_NUMBER = "5535998844504";
export const INSTAGRAM_HANDLE = "jannah_silvaah";
export const INSTAGRAM_URL = "https://www.instagram.com/jannah_silvaah?igsh=OTRoZjFka2p0dDhn";
export const AUTH_EMAIL_DOMAIN = "jannahnails.app";
export const LOYALTY_CYCLE = 5;
export const LOYALTY_DISCOUNT = 0.2;

export const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export const APPOINTMENT_STATUS: Record<string, string> = {
  pendente: "Aguardando confirmação",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function slugifyLogin(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

export function loginEmail(loginId: string) {
  return `${slugifyLogin(loginId).toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

export function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${Math.floor(hours)}h${minutes % 60}`;
}

export function formatPhone(phone: string) {
  const d = onlyDigits(phone);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

export function maskPhone(phone: string) {
  const d = onlyDigits(phone);
  if (d.length < 6) return "••••";
  return `(${d.slice(0, 2)}) ••••-${d.slice(-4)}`;
}

export function formatDayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", weekday: "long" });
}

export function shortTime(time: string) {
  return time.slice(0, 5);
}

export function whatsappLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Normalizes a Brazilian phone to wa.me format (adds country code 55 when missing). */
export function toWhatsappNumber(phone: string) {
  const d = onlyDigits(phone);
  if (!d) return null;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length >= 12 && d.length <= 13 && d.startsWith("55")) return d;
  if (d.length >= 12) return d;
  return null;
}

/** WhatsApp link addressed to a specific person (e.g. the client). */
export function whatsappLinkTo(phone: string, message: string) {
  const number = toWhatsappNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}