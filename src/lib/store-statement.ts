import type { jsPDF } from "jspdf";

import { type StoreOrderWithDetails } from "@/lib/store";
import { ORDER_STATUS_LABELS, formatISODate, formatPhone, formatPrice } from "@/lib/salon";

export type StatementTotals = {
  totalCents: number;
  paidCents: number;
  pendingCents: number;
};

/** Soma compras, valores pagos e pendentes a partir das parcelas de cada pedido. */
export function statementTotals(orders: StoreOrderWithDetails[]): StatementTotals {
  let totalCents = 0;
  let paidCents = 0;
  for (const order of orders) {
    totalCents += order.amount_cents;
    for (const parcel of order.installments_list) {
      if (parcel.paid_at) paidCents += parcel.amount_cents;
    }
  }
  let pendingCents = 0;
  for (const order of orders) {
    for (const parcel of order.installments_list) {
      // Parcelas unificadas em outro pedido não são cobradas novamente.
      if (!parcel.paid_at && !parcel.merged_into_order_id) pendingCents += parcel.amount_cents;
    }
  }
  return { totalCents, paidCents, pendingCents };
}

export function statementFileName(clientName: string): string {
  const slug = clientName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `extrato-${slug || "cliente"}.pdf`;
}

/** Data de criação (timestamp ISO) em DD/MM/AAAA, sem conversão de fuso. */
function orderDateLabel(createdAt?: string | null): string {
  if (!createdAt) return "—";
  return formatISODate(createdAt.slice(0, 10));
}

function paymentCondition(order: StoreOrderWithDetails): string {
  return order.installments > 1 ? `Parcelado em ${order.installments}x` : "À vista";
}

function orderItems(order: StoreOrderWithDetails) {
  if (order.items.length) return order.items;
  return [
    {
      id: order.id,
      order_id: order.id,
      name: order.item_name,
      unit_price_cents: order.amount_cents,
      sort_order: 0,
    },
  ];
}

function generatedLabel(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} às ${p(date.getHours())}:${p(date.getMinutes())}`;
}

type Palette = { ink: [number, number, number]; soft: [number, number, number]; line: [number, number, number] };

const PALETTE: Palette = { ink: [31, 36, 48], soft: [90, 99, 114], line: [205, 210, 219] };

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PAGE_H = 297;

/**
 * Desenha o extrato do cliente em texto vetorial (legível e leve),
 * sem depender de captura de tela do navegador.
 */
export function drawStatement(
  doc: jsPDF,
  args: {
    clientName: string;
    clientPhone: string;
    orders: StoreOrderWithDetails[];
    generatedAt?: Date;
  },
): void {
  const totals = statementTotals(args.orders);
  let y = MARGIN;

  const setInk = (color: [number, number, number]) => doc.setTextColor(color[0], color[1], color[2]);
  const ensureSpace = (needed: number) => {
    if (y + needed <= PAGE_H - MARGIN) return;
    doc.addPage();
    y = MARGIN;
  };

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setInk(PALETTE.ink);
  doc.text("Studio Jannah Nails — Loja", MARGIN, y + 4);
  y += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setInk(PALETTE.soft);
  doc.text(`Extrato do cliente: ${args.clientName}`, MARGIN, y);
  y += 5;
  doc.text(
    `Telefone: ${args.clientPhone ? formatPhone(args.clientPhone) : "não informado"}`,
    MARGIN,
    y,
  );
  y += 5;
  doc.text(`Documento gerado em ${generatedLabel(args.generatedAt ?? new Date())}`, MARGIN, y);
  y += 4;
  doc.setDrawColor(PALETTE.soft[0], PALETTE.soft[1], PALETTE.soft[2]);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  // Resumo em três cartões
  const cardW = (CONTENT_W - 8) / 3;
  const cards: [string, string][] = [
    ["Total de compras", formatPrice(totals.totalCents)],
    ["Total já pago", formatPrice(totals.paidCents)],
    ["Total pendente", formatPrice(totals.pendingCents)],
  ];
  doc.setDrawColor(PALETTE.line[0], PALETTE.line[1], PALETTE.line[2]);
  doc.setLineWidth(0.3);
  cards.forEach(([label, value], index) => {
    const x = MARGIN + index * (cardW + 4);
    doc.roundedRect(x, y, cardW, 16, 1.5, 1.5);
    doc.setFontSize(8);
    setInk(PALETTE.soft);
    doc.text(label.toUpperCase(), x + 3, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    setInk(PALETTE.ink);
    doc.text(value, x + 3, y + 12.5);
    doc.setFont("helvetica", "normal");
  });
  y += 24;

  if (args.orders.length === 0) {
    doc.setFontSize(10);
    setInk(PALETTE.soft);
    doc.text("Nenhum pedido registrado para este cliente.", MARGIN, y);
    return;
  }

  for (const order of args.orders) {
    const items = orderItems(order);
    const blockHeight = 26 + items.length * 5.5 + Math.max(1, order.installments_list.length) * 5.5;
    ensureSpace(blockHeight);

    // Título do pedido
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setInk(PALETTE.ink);
    doc.text(`Pedido de ${orderDateLabel(order.created_at)}`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setInk(PALETTE.soft);
    doc.text(
      ORDER_STATUS_LABELS[order.status] ?? order.status,
      PAGE_W - MARGIN,
      y,
      { align: "right" },
    );
    y += 5;

    // Itens
    doc.setFontSize(8);
    doc.text("ITEM", MARGIN, y);
    doc.text("VALOR UNITÁRIO", PAGE_W - MARGIN, y, { align: "right" });
    y += 1.5;
    doc.setDrawColor(PALETTE.line[0], PALETTE.line[1], PALETTE.line[2]);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 4;
    doc.setFontSize(10);
    setInk(PALETTE.ink);
    for (const item of items) {
      ensureSpace(8);
      doc.text(doc.splitTextToSize(item.name, CONTENT_W - 40)[0] ?? item.name, MARGIN, y);
      doc.text(formatPrice(item.unit_price_cents), PAGE_W - MARGIN, y, { align: "right" });
      y += 5.5;
    }
    doc.setFont("helvetica", "bold");
    doc.text("Total do pedido", MARGIN, y);
    doc.text(formatPrice(order.amount_cents), PAGE_W - MARGIN, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 6;

    // Condição de pagamento
    doc.setFontSize(9);
    setInk(PALETTE.soft);
    const condition = `Condição de pagamento: ${paymentCondition(order)}${
      order.delivery_date ? ` · Entrega prevista: ${formatISODate(order.delivery_date)}` : ""
    }`;
    doc.text(condition, MARGIN, y);
    y += 6;

    // Parcelas
    doc.setFontSize(8);
    doc.text("PARCELA", MARGIN, y);
    doc.text("VALOR", MARGIN + 45, y);
    doc.text("VENCIMENTO", MARGIN + 75, y);
    doc.text("SITUAÇÃO", MARGIN + 115, y);
    y += 1.5;
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 4;
    doc.setFontSize(9.5);
    if (order.installments_list.length === 0) {
      setInk(PALETTE.soft);
      doc.text("Sem parcelas registradas.", MARGIN, y);
      y += 5.5;
    } else {
      for (const parcel of order.installments_list) {
        ensureSpace(8);
        setInk(PALETTE.ink);
        doc.text(
          order.installments > 1 ? `${parcel.number}ª parcela` : "Pagamento único",
          MARGIN,
          y,
        );
        doc.text(formatPrice(parcel.amount_cents), MARGIN + 45, y);
        doc.text(formatISODate(parcel.due_date), MARGIN + 75, y);
        const paid = Boolean(parcel.paid_at);
        doc.text(
          parcel.merged_into_order_id
            ? "Unificada em novo pedido"
            : paid
              ? `Paga em ${formatISODate(parcel.paid_at?.slice(0, 10) ?? null)}`
              : "Pendente",
          MARGIN + 115,
          y,
        );
        y += 5.5;
        if (parcel.merged_extra_cents > 0) {
          ensureSpace(8);
          doc.setFontSize(8);
          setInk(PALETTE.soft);
          doc.text(
            `(Inclui ${formatPrice(parcel.merged_extra_cents)} do pedido anterior)`,
            MARGIN + 4,
            y,
          );
          doc.setFontSize(9.5);
          y += 5;
        }
      }
    }
    y += 4;
    doc.setDrawColor(PALETTE.line[0], PALETTE.line[1], PALETTE.line[2]);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 8;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    setInk(PALETTE.soft);
    doc.text(
      `Studio Jannah Nails — Loja · página ${page} de ${pages}`,
      PAGE_W / 2,
      PAGE_H - 8,
      { align: "center" },
    );
  }
}
