export const SALON_NAME = "Jannah Nails";
export const OWNER_NAME = "Janaina Silva";
export const WHATSAPP_NUMBER = "5535998844504";
export const INSTAGRAM_HANDLE = "jannah_silvaah";
export const INSTAGRAM_URL = "https://www.instagram.com/jannah_silvaah?igsh=OTRoZjFka2p0dDhn";

/**
 * Contato oficial do salão em tempo de execução. A administradora edita esses
 * valores na engrenagem do painel e todos os links/disparos passam a usá-los.
 */
const salonContact = { whatsapp: WHATSAPP_NUMBER, instagram: INSTAGRAM_URL };

export function setSalonContact(contact: {
  whatsapp?: string | null | undefined;
  instagram?: string | null | undefined;
}) {
  const digits = onlyDigits(String(contact.whatsapp ?? ""));
  if (digits.length >= 10) salonContact.whatsapp = toWhatsappNumber(digits) ?? digits;
  const instagram = String(contact.instagram ?? "").trim();
  if (instagram) salonContact.instagram = instagram;
}

/** Número atual do WhatsApp oficial (formato wa.me). */
export function salonWhatsapp() {
  return salonContact.whatsapp;
}

/** Link atual do Instagram do salão. */
export function salonInstagram() {
  return salonContact.instagram;
}
export const AUTH_EMAIL_DOMAIN = "jannahnails.app";
/** Local do atendimento enviado no convite da Google Agenda. */
export const SALON_ADDRESS = "Studio Jannah Nails — Nails Design (confirme o endereço no WhatsApp)";
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

/** Rótulo dinâmico do resgate exibido para a cliente (com o percentual real). */
export function benefitBadgeLabel(benefitType: string, percent: number) {
  if (benefitType === "premio") return "Prêmio de Sorteio / Evento";
  if (benefitType === "fidelidade") return `Resgate Fidelidade (-${percent || Math.round(LOYALTY_DISCOUNT * 100)}%)`;
  if (benefitType === "indicacao") return `Resgate Indicação (-${percent || Math.round(REFERRAL_DISCOUNT * 100)}%)`;
  if (benefitType === "parcial") return `Reembolso de pontos (-${percent}%)`;
  return null;
}

/** Desconto exibido no WhatsApp: "Grátis" para prêmios, percentual nos demais. */
export function discountDisplay(benefitType: string, percent: number) {
  if (benefitType === "premio") return percent > 0 ? `${percent}%` : "Prêmio (a combinar)";
  return `${percent}%`;
}

/** Mensagem detalhada enviada à administradora quando o pré-agendamento usa um resgate. */
export function claimBookingMessage(args: {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  day: string;
  start: string;
  benefitType: string;
  percent: number;
  originalCents: number;
  finalCents: number;
}) {
  return [
    "🌸 Novo Pré-Agendamento com Resgate de Benefício! 🌸",
    "",
    `Cliente: ${args.clientName}`,
    `Telefone: ${formatPhone(args.clientPhone)}`,
    `Procedimento: ${args.serviceName}`,
    `Data/Horário: ${formatDayLabel(args.day)} às ${shortTime(args.start)}`,
    "",
    `🎁 Tipo de Resgate: ${benefitBadgeLabel(args.benefitType, args.percent) ?? "Benefício"}`,
    `💰 Valor Original: ${formatPrice(args.originalCents)}`,
    `🏷️ Desconto Aplicado: ${discountDisplay(args.benefitType, args.percent)}`,
    `💵 Valor Final a Pagar: ${formatPrice(args.finalCents)}`,
    "",
    "Aguardando sua confirmação no Painel Admin!",
  ].join("\n");
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

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

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
  const encoded = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${salonContact.whatsapp}&text=${encoded}`;
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
  const encoded = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${number}&text=${encoded}`;
}

/**
 * Abre uma URL do WhatsApp de forma resiliente a bloqueio de pop-up.
 * Depois de operações assíncronas o navegador não trata mais `window.open`
 * como gesto do usuário, então caímos para navegação direta.
 */
export function openWhatsappUrl(url: string) {
  if (typeof document === "undefined") return false;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}

export type AppointmentNotice = {
  name: string;
  day: string;
  start: string;
  durationMinutes: number;
  serviceName: string;
};

/** Data/horário legível para reconfirmação: "Amanhã às 09:00" ou "Sábado, 22 de Agosto às 09:00". */
export function formatConfirmDateTime(day: string, start: string) {
  return `${dayGroupLabel(day)} às ${shortTime(start)}`;
}

/** Mensagem carismática de confirmação enviada à cliente. */
export function confirmationMessage(n: AppointmentNotice) {
  const start = shortTime(n.start);
  // O addMinutes deve receber o objeto de data/hora original n.start
  const end = shortTime(addMinutes(n.start, n.durationMinutes));

  return [
    `Oba, ${n.name}! 💖`,
    `Seu horário está oficialmente CONFIRMADO por mim! ✨`,
    "",
    `Estou muito feliz em ter você aqui no ${SALON_NAME}!`,
    `Mal posso esperar para cuidar das suas unhas com todo o carinho e dedicação que você merece.`,
    "",
    `📅 Data: ${formatDayLabel(n.day)}`,
    `⏰ Horário: ${start} às ${end}`,
    `💅 Serviço: ${n.serviceName}`,
    "",
    "Muito obrigada pela confiança! Nos vemos em breve! 🥰",
  ].join("\n");
}

/** Mensagem de reconfirmação de presença enviada a clientes já confirmadas. */
export function reconfirmMessage(n: { name: string; day: string; start: string }) {
  return [
    `Olá! Como você está? ✨`,
    "",
    `Passando para confirmar o seu horário de atendimento agendado para ${formatConfirmDateTime(n.day, n.start)}. 🌸`,
    "",
    "Você confirma a sua presença?",
    "",
    "Fico no aguardo da sua resposta! 🥰",
  ].join("\n");
}

/** Mensagem carismática de cancelamento, convidando a cliente a reagendar. */
/** Boas-vindas para clientes cadastradas manualmente pela administradora. */
export function adminWelcomeMessage(n: {
  loginId: string;
  phoneDigits: string;
  serviceName: string;
  day: string;
  start: string;
}) {
  return [
    `Seja muito bem-vinda ao ${SALON_NAME}! 💖`,
    "",
    "Seu cadastro no nosso aplicativo foi criado por mim com todo carinho! A partir de agora você pode gerenciar seus horários, acumular pontos no clube de fidelidade e ver nossas novidades.",
    "",
    "📱 Acesse o aplicativo pelo link:",
    "https://nail-joy-planner.lovable.app",
    "",
    `👤 Seu Usuário: ${n.loginId}`,
    `🔑 Sua Senha Inicial: ${n.phoneDigits}`,
    "",
    "📅 Seu Agendamento:",
    `Procedimento: ${n.serviceName}`,
    `Data/Horário: ${formatDayLabel(n.day)} às ${shortTime(n.start)}`,
    "",
    "Muito obrigada e nos vemos em breve! ✨",
  ].join("\n");
}

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

/** Antecedência mínima (em horas) para a cliente pedir alteração pelo app. */
export const RESCHEDULE_MIN_HOURS = 72;

/** Horas restantes até o atendimento (fuso do salão, America/Sao_Paulo). */
export function hoursUntilAppointment(day: string, start: string) {
  const target = new Date(`${day}T${shortTime(start)}:00-03:00`).getTime();
  return (target - Date.now()) / 3600000;
}

/** A cliente só pode pedir alteração com mais de 72h de antecedência. */
export function canClientReschedule(day: string, start: string) {
  return hoursUntilAppointment(day, start) > RESCHEDULE_MIN_HOURS;
}

/** Alerta enviado à administradora quando a cliente pede reagendamento. */
export function adminRescheduleRequestAlert(n: {
  name: string;
  serviceName: string;
  oldDay: string;
  oldStart: string;
  newDay: string;
  newStart: string;
  reason: string;
}) {
  return [
    "🔄 Pedido de Reagendamento pela Cliente!",
    "",
    `Cliente: ${n.name}`,
    `Serviço: ${n.serviceName}`,
    `Horário atual: ${formatDayLabel(n.oldDay)} às ${shortTime(n.oldStart)}`,
    `Nova opção escolhida: ${formatDayLabel(n.newDay)} às ${shortTime(n.newStart)}`,
    "",
    `Motivo informado: ${n.reason}`,
    "",
    "Aprove ou recuse no Painel Admin, na aba de pré-agendamentos.",
  ].join("\n");
}

/** Aviso carinhoso de horário atualizado enviado para a cliente. */
export function rescheduleMessage(n: {
  name: string;
  serviceName: string;
  oldDay: string;
  oldStart: string;
  day: string;
  start: string;
  durationMinutes: number;
}) {
  const start = shortTime(n.start);
  const end = addMinutes(start, n.durationMinutes);
  return [
    `Oi, ${n.name}! 💖 Seu horário foi atualizado e já está CONFIRMADO! ✨`,
    "",
    `Antes: ${formatDayLabel(n.oldDay)} às ${shortTime(n.oldStart)}`,
    "",
    `📅 Nova data: ${formatDayLabel(n.day)}`,
    `⏰ Novo horário: ${start} às ${end}`,
    `💅 Serviço: ${n.serviceName}`,
    "",
    `Sua Google Agenda já foi atualizada. Qualquer dúvida, me chame! 🥰 — ${SALON_NAME}`,
  ].join("\n");
}
