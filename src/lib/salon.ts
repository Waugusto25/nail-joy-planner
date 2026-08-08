export const SALON_NAME = "Jannah Nails";
export const OWNER_NAME = "Janaina Silva";
export const WHATSAPP_NUMBER = "5535998844504";
export const INSTAGRAM_HANDLE = "jannah_silvaah";
export const INSTAGRAM_URL = "https://www.instagram.com/jannah_silvaah?igsh=OTRoZjFka2p0dDhn";
export const AUTH_EMAIL_DOMAIN = "jannahnails.app";
export const LOYALTY_CYCLE = 5;
export const LOYALTY_DISCOUNT = 0.2;
/** Cada procedimento acumulado vale 4% quando o programa é desativado. */
export const LOYALTY_PARTIAL_STEP = 0.04;
/** Desconto imediato por indicação concluída. */
export const REFERRAL_DISCOUNT = 0.1;

export const BENEFIT_LABELS: Record<string, string> = {
  nenhum: "Sem desconto",
  fidelidade: "Fidelidade -20%",
  parcial: "Reembolso de pontos",
  indicacao: "Indicação -10%",
  premio: "Prêmio de sorteio",
};

/** Etiqueta de destaque para reivindicações de prêmio, cupom ou fidelidade. */
export function claimTag(benefitType: string) {
  if (benefitType === "premio") return "🎁 Resgate de prêmio";
  if (benefitType === "indicacao") return "🎁 Resgate de cupom de indicação";
  if (benefitType === "fidelidade") return "⭐ Reivindicação de fidelidade";
  if (benefitType === "parcial") return "⭐ Reembolso de pontos";
  return null;
}

/** Formas de pagamento aceitas no fechamento de caixa. */
export const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "credito", label: "Cartão de crédito" },
  { value: "debito", label: "Cartão de débito" },
  { value: "dinheiro", label: "Dinheiro" },
] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label]),
);

/** ISO date (YYYY-MM-DD) de N dias atrás — janela de validade dos pontos. */
/** Antecedência mínima (minutos) para agendar um horário no dia de hoje. */
export const BOOKING_LEAD_MINUTES = 30;

/** Data de hoje no fuso do dispositivo (YYYY-MM-DD) — nunca usar toISOString (UTC). */
export function localTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Minutos desde a meia-noite do horário local atual. */
export function currentMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function isoDaysAgo(days: number) {
  const d = new Date(Date.now() - days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

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

/** Status possíveis de um pedido da loja/catálogo. */
export const ORDER_STATUSES = [
  { value: "pendente", label: "Pendente" },
  { value: "encomendado", label: "Encomendado" },
  { value: "pronto", label: "Pronto para retirada" },
  { value: "entregue", label: "Entregue" },
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ORDER_STATUSES.map((s) => [s.value, s.label]),
);

/** "À vista" ou "3x de R$ 20,00" */
export function formatInstallments(installments: number, amountCents: number) {
  if (!installments || installments <= 1) return "À vista";
  return `${installments}x de ${formatPrice(Math.round(amountCents / installments))}`;
}

/** Rótulo amigável de agrupamento por dia: Hoje, Amanhã ou a data completa. */
export function dayGroupLabel(day: string) {
  const today = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(today.getTime() + 86400000);
  if (day === iso(today)) return "Hoje";
  if (day === iso(tomorrow)) return "Amanhã";
  return formatDayLabel(day);
}

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

/** "08:30" | "08:30:00" -> minutes since midnight */
export function timeToMinutes(time: string) {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** minutes since midnight -> "08:30" (fully dynamic, supports any duration) */
export function minutesToTime(minutes: number) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function addMinutes(time: string, minutes: number) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

/** "08:30 às 09:45 (1h15)" */
export function formatTimeRange(start: string, durationMinutes: number) {
  return `${shortTime(start)} às ${addMinutes(start, durationMinutes)} (${formatDuration(durationMinutes)})`;
}

export function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
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

export type AppointmentNotice = {
  name: string;
  day: string;
  start: string;
  durationMinutes: number;
  serviceName: string;
};

/** Mensagem carismática de confirmação enviada à cliente. */
export function confirmationMessage(n: AppointmentNotice) {
  const start = shortTime(n.start);
  const end = addMinutes(start, n.durationMinutes);
  return [
    `Oba, ${n.name}! 💖 Seu horário está oficialmente CONFIRMADO por mim! ✨`,
    "",
    `Estou muito feliz em ter você aqui no ${SALON_NAME}! Mal posso esperar para cuidar das suas unhas com todo o carinho e dedicação que você merece.`,
    "",
    `📅 Data: ${formatDayLabel(n.day)}`,
    `⏰ Horário: ${start} às ${end}`,
    `💅 Serviço: ${n.serviceName}`,
    "",
    "Muito obrigada pela confiança! Nos vemos em breve! 🥰",
  ].join("\n");
}

/** Mensagem carismática de cancelamento, convidando a cliente a reagendar. */
export function cancellationMessage(n: AppointmentNotice) {
  const start = shortTime(n.start);
  return [
    `Oi, ${n.name}! 💗 Seu horário de ${n.serviceName} em ${formatDayLabel(n.day)} às ${start} foi cancelado.`,
    "",
    "Fica tudo bem! Sempre que quiser, é só abrir o aplicativo e escolher um novo dia e horário — sua vaga estará esperando por você. 💅✨",
    "",
    `Qualquer dúvida, me chame. Um beijo! 🥰 — ${SALON_NAME}`,
  ].join("\n");
}

/** Alerta enviado à administradora quando a própria cliente cancela pelo app. */
export function adminCancellationAlert(n: AppointmentNotice) {
  const start = shortTime(n.start);
  return [
    "⚠️ Agendamento Cancelado pela Cliente!",
    "",
    `Cliente: ${n.name}`,
    `Serviço: ${n.serviceName}`,
    `Data/Horário: ${formatDayLabel(n.day)} às ${start}`,
    "",
    "O horário correspondente foi automaticamente liberado na sua agenda do aplicativo.",
  ].join("\n");
}

/** Mensagem cortês exibida à cliente após o cancelamento. */
export function clientCancelConfirmation(day: string, start: string) {
  return `Seu agendamento para o dia ${formatDayLabel(day)} às ${shortTime(start)} foi cancelado com sucesso. Agradecemos por nos avisar com antecedência! Esperamos ver você em breve. 💖`;
}

/** Dias que um cancelamento fica visível no histórico da cliente. */
export const CANCELLED_HISTORY_DAYS = 3;
