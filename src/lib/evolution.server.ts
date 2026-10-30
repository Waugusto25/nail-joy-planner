import { z } from "zod";
import { whatsappConfigSchema, whatsappPhone } from "./whatsapp-rules";
import { adminCancellationAlert, adminRescheduleRequestAlert, cancellationMessage, confirmationMessage, formatPrice, reconfirmMessage, rescheduleMessage, APP_URL } from "./salon";
import { createPublicClient } from "./supabase-public.server";

const payloadSchema = z.object({
  phone: z.string().nullish(), name: z.string().nullish(), day: z.string().optional(), start: z.string().optional(),
  serviceName: z.string().nullish(), durationMinutes: z.number().nullish(), priceCents: z.number().optional(),
  discountPercent: z.number().nullish(), benefitType: z.string().nullish(), oldDay: z.string().optional(), oldStart: z.string().optional(),
  newDay: z.string().optional(), newStart: z.string().optional(), reason: z.string().nullish(),
  amountCents: z.number().optional(), number: z.number().optional(), partial: z.boolean().optional(),
  dueDate: z.string().optional(), title: z.string().optional(), prize: z.string().optional(), loginId: z.string().optional(),
}).passthrough();
const batchSchema = z.object({ enabled: z.boolean(), settings: whatsappConfigSchema.optional(), adminPhone: z.string().nullish(), pixKey: z.string().nullish(), messages: z.array(z.object({ id: z.string().uuid(), kind: z.string(), payload: payloadSchema })) });
type Payload = z.infer<typeof payloadSchema>;

function messageText(kind: string, p: Payload, pixKey: string): string {
  const n = { name: p.name || "Cliente", day: p.day || "", start: p.start || "", serviceName: p.serviceName || "Procedimento", durationMinutes: p.durationMinutes || 60 };
  switch (kind) {
    case "prebooking": return `💅 Novo pré-agendamento!\nCliente: ${n.name}\nTelefone: ${p.phone || ""}\nProcedimento: ${n.serviceName}\nData: ${n.day} às ${n.start.slice(0, 5)}\nValor final: ${formatPrice(p.priceCents || 0)}${p.discountPercent ? `\nBenefício: ${p.benefitType} (${p.discountPercent}%)` : ""}`;
    case "confirmation": return confirmationMessage(n);
    case "reminder": return reconfirmMessage(n);
    case "cancellation": return cancellationMessage(n);
    case "client_cancelled": return adminCancellationAlert(n);
    case "reschedule": return rescheduleMessage({ ...n, oldDay: p.oldDay || "", oldStart: p.oldStart || "" }).replace("Sua Google Agenda já foi atualizada.", "Seu horário no aplicativo foi atualizado.");
    case "reschedule_request": return adminRescheduleRequestAlert({ name: n.name, serviceName: n.serviceName, oldDay: p.oldDay || "", oldStart: p.oldStart || "", newDay: p.newDay || "", newStart: p.newStart || "", reason: p.reason || "" });
    case "loyalty": return `Parabéns, ${n.name}! 💖 Sua cartela de ${n.serviceName} está completa. Você ganhou 20% de desconto para o próximo atendimento! ${APP_URL}`;
    case "referral": return `Olá, ${n.name}! 💖 Sua indicação concluiu o atendimento e seu bônus está disponível no aplicativo: ${APP_URL}`;
    case "winner": return `Parabéns, ${n.name}! 🎉 Você ganhou o sorteio ${p.title}! Prêmio: ${p.prize}. Fale com a Janaina para combinar a entrega.`;
    case "welcome": return `Seja bem-vinda à Jannah Nails! 💖 Seu cadastro foi criado.\nAcesse: ${APP_URL}\nUsuário: ${p.loginId}\nUse seu telefone para entrar e gerenciar seus horários.`;
    case "contact": return `Olá, ${n.name}! Aqui é a Janaina da Jannah Nails. 💖`;
    case "receipt": return `Olá! Seu pagamento de ${formatPrice(p.amountCents || 0)} referente à parcela ${p.number} foi confirmado. ${p.partial ? "Pagamento parcial recebido; o saldo restante permanece em aberto." : "Parcela quitada."} Obrigado! 🛍️✨`;
    case "due": return `Olá! A parcela ${p.number}, com vencimento em ${(p.dueDate || "").split("-").reverse().join("/")}, está em aberto.\nValor: ${formatPrice(p.amountCents || 0)}${pixKey ? `\nChave Pix: ${pixKey}` : ""}\nSe já pagou, envie o comprovante. Obrigado!`;
    default: throw new Error("Mensagem não autorizada.");
  }
}

export async function sendEvolution(config: z.infer<typeof whatsappConfigSchema>, phone: string, text: string): Promise<void> {
  const safe = whatsappConfigSchema.parse(config);
  const key = process.env["EVOLUTION_API_KEY"];
  if (!key) throw new Error("Chave da Evolution não configurada.");
  const url = new URL(safe.api_url);
  if (url.username || url.password || /^(localhost|127\.|169\.254\.|10\.|192\.168\.|\[)/.test(url.hostname)) throw new Error("Endereço de API inválido.");
  const response = await fetch(`${safe.api_url.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(safe.instance_name)}`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(15000), headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ number: whatsappPhone(phone), text }),
  });
  // Não armazenar a resposta da VPS: ela pode conter chave ou dados de clientes.
  if (!response.ok) throw new Error(`Evolution recusou o envio (HTTP ${response.status}).`);
}

export async function processWhatsapp(serviceToken: string): Promise<{ sent: number; failed: number }> {
  const db = createPublicClient();
  const { data, error } = await db.rpc("whatsapp_claim", { p_token: serviceToken });
  if (error) throw new Error("Fila de mensagens indisponível.");
  const batch = batchSchema.parse(data);
  let sent = 0, failed = 0;
  if (!batch.enabled || !batch.settings) return { sent, failed };
  for (const m of batch.messages) {
    let status = "sent", lastError: string | null = null;
    try {
      const valid = await db.rpc("whatsapp_delivery_valid", { p_token: serviceToken, p_kind: m.kind, p_payload: m.payload });
      if (valid.error) throw new Error("Não foi possível validar a mensagem.");
      if (!valid.data) status = "skipped";
      else {
        const phone = ["prebooking", "client_cancelled", "reschedule_request"].includes(m.kind) ? batch.adminPhone : m.payload.phone;
        await sendEvolution(batch.settings, phone || "", messageText(m.kind, m.payload, batch.pixKey || ""));
        sent++;
      }
    } catch {
      failed++; status = "failed"; lastError = "Envio não confirmado; confira conexão e telefone.";
    }
    const done = await db.rpc("whatsapp_finish", { p_token: serviceToken, p_id: m.id, p_status: status, p_error: lastError });
    if (done.error) throw new Error("Não foi possível registrar o resultado do envio.");
  }
  return { sent, failed };
}