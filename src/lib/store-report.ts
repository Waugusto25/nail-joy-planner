import type { jsPDF } from "jspdf";

import { formatISODate, formatPhone, formatPrice } from "@/lib/salon";
import { installmentState, type StoreOrderWithDetails } from "@/lib/store";

const M = 14;
const W = 210 - M * 2;
const PAGE_H = 297;

const STATE_LABEL = {
  paga: "Paga",
  parcial: "Paga parcialmente",
  pendente: "Pendente",
  transferida: "Unificada em outro pedido",
} as const;

export function reportFileName(clientName: string): string {
  const slug = clientName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `relatorio-${slug || "cliente"}.pdf`;
}

function dateOf(ts: string | null): string {
  return ts ? formatISODate(ts.slice(0, 10)) : "—";
}

/**
 * Relatório de auditoria de um pedido: compras, pagamentos e a origem de cada
 * crédito/acréscimo, para explicar qualquer valor que aparece nas parcelas.
 */
export function drawOrderReport(doc: jsPDF, order: StoreOrderWithDetails): void {
  let y = M;
  const line = (text: string, opts: { bold?: boolean; size?: number; indent?: number; color?: [number, number, number] } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 9.5);
    const c = opts.color ?? [31, 36, 48];
    doc.setTextColor(c[0], c[1], c[2]);
    const wrapped = doc.splitTextToSize(text, W - (opts.indent ?? 0)) as string[];
    for (const row of wrapped) {
      if (y > PAGE_H - M) {
        doc.addPage();
        y = M;
      }
      doc.text(row, M + (opts.indent ?? 0), y);
      y += (opts.size ?? 9.5) * 0.48;
    }
  };
  const gap = (h = 3) => {
    y += h;
  };
  const rule = () => {
    doc.setDrawColor(205, 210, 219);
    doc.line(M, y, M + W, y);
    y += 4;
  };

  const parcels = order.installments_list
    .filter((p) => !p.merged_into_order_id)
    .sort((a, b) => a.number - b.number);
  const paidCents = parcels.reduce(
    (s, p) => s + (p.paid_at ? p.paid_amount_cents || p.amount_cents : 0),
    0,
  );
  const pendingCents = parcels.reduce((s, p) => {
    if (!p.paid_at) return s + p.amount_cents;
    return p.paid_amount_cents > 0 ? s + Math.max(0, p.amount_cents - p.paid_amount_cents) : s;
  }, 0);

  line("Studio Jannah Nails — Relatório detalhado da cliente", { bold: true, size: 14 });
  gap(2);
  line(`Cliente: ${order.client_name}${order.nickname ? ` (${order.nickname})` : ""}`);
  line(`Telefone: ${order.client_phone ? formatPhone(order.client_phone) : "não informado"}`);
  line(`Pedido criado em ${dateOf(order.created_at)} · Gerado em ${formatISODate(new Date().toISOString().slice(0, 10))}`);
  gap();
  rule();

  line("RESUMO", { bold: true, size: 11 });
  line(`Total comprado: ${formatPrice(order.amount_cents)}`);
  line(`Total pago: ${formatPrice(paidCents)}`, { color: [21, 105, 57] });
  line(`Ainda deve: ${formatPrice(pendingCents)}`, { bold: true, color: [160, 40, 40] });
  gap();
  rule();

  line("PRODUTOS COMPRADOS", { bold: true, size: 11 });
  const items = order.items.length
    ? order.items
    : [{ id: order.id, name: order.item_name, unit_price_cents: order.amount_cents, start_installment: 1, installments_count: order.installments }];
  for (const item of items) {
    const plan =
      item.start_installment && item.installments_count
        ? ` — parcelas ${item.start_installment} a ${item.start_installment + item.installments_count - 1}`
        : "";
    line(`• ${item.name}: ${formatPrice(item.unit_price_cents)}${plan}`, { indent: 2 });
  }
  gap();
  rule();

  line("PARCELAS — COMPOSIÇÃO E PAGAMENTOS", { bold: true, size: 11 });
  const notes: string[] = [];
  parcels.forEach((p, i) => {
    const original =
      p.amount_cents + p.credit_applied_cents - p.added_extra_cents - p.merged_extra_cents - p.carried_in_cents;
    gap(1.5);
    line(
      `Parcela ${p.number} — vencimento ${p.due_date ? formatISODate(p.due_date) : "a definir"} — ${STATE_LABEL[installmentState(p)]}`,
      { bold: true },
    );
    line(`Valor base do pedido: ${formatPrice(Math.max(0, original))}`, { indent: 3 });
    if (p.added_extra_cents > 0)
      line(`+ ${formatPrice(p.added_extra_cents)} de produto acrescentado depois`, { indent: 3 });
    if (p.merged_extra_cents > 0)
      line(`+ ${formatPrice(p.merged_extra_cents)} de parcela de outro pedido unificada aqui`, { indent: 3 });
    if (p.carried_in_cents > 0)
      line(`+ ${formatPrice(p.carried_in_cents)} que faltou pagar na parcela anterior`, { indent: 3 });
    if (p.credit_applied_cents > 0)
      line(`- ${formatPrice(p.credit_applied_cents)} de crédito (troco) de pagamento anterior`, { indent: 3, color: [21, 105, 57] });
    line(`= Valor cobrado: ${formatPrice(p.amount_cents)}`, { indent: 3, bold: true });
    if (p.paid_at) {
      const received = p.paid_amount_cents || p.amount_cents;
      line(`Pago em ${dateOf(p.paid_at)}: ${formatPrice(received)}${p.mp_status === "approved" ? " (Mercado Pago)" : ""}`, { indent: 3 });
    } else if (p.paid_amount_cents > 0) {
      line(`Valor registrado sem data de pagamento: ${formatPrice(p.paid_amount_cents)}`, { indent: 3, color: [146, 89, 8] });
    }

    // Origem dos ajustes: explica em texto o que o sistema fez automaticamente.
    const received = p.paid_amount_cents;
    if (p.paid_at && received > p.amount_cents) {
      const next = parcels[i + 1];
      notes.push(
        `Parcela ${p.number}: cobrada ${formatPrice(p.amount_cents)}, recebido ${formatPrice(received)}. Sobra de ${formatPrice(received - p.amount_cents)} virou crédito${next ? ` abatido na parcela ${next.number}` : ""}.`,
      );
    } else if (p.paid_at && received > 0 && received < p.amount_cents) {
      const next = parcels[i + 1];
      notes.push(
        `Parcela ${p.number}: cobrada ${formatPrice(p.amount_cents)}, recebido ${formatPrice(received)}. Faltaram ${formatPrice(p.amount_cents - received)}${next ? `, somados na parcela ${next.number}` : ""}.`,
      );
    }
    if (!p.paid_at && received > p.amount_cents) {
      const next = parcels[i + 1];
      notes.push(
        `Parcela ${p.number}: foi registrado um pagamento de ${formatPrice(received)} (cobrada ${formatPrice(p.amount_cents)}) e depois a data de pagamento foi apagada. A sobra de ${formatPrice(received - p.amount_cents)} ficou como crédito${next ? ` na parcela ${next.number}` : ""} — confira se essa parcela foi mesmo paga.`,
      );
    }
    if (p.added_extra_cents > 0)
      notes.push(`Parcela ${p.number}: inclui ${formatPrice(p.added_extra_cents)} de produto(s) acrescentado(s) ao pedido.`);
  });
  gap();
  rule();

  line("DE ONDE VÊM OS CRÉDITOS E ACRÉSCIMOS", { bold: true, size: 11 });
  if (notes.length === 0) line("Nenhum crédito, sobra ou acréscimo neste pedido.");
  notes.forEach((n) => line(`• ${n}`, { indent: 2 }));
}
