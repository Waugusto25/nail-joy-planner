import type { jsPDF } from "jspdf";

import {
  allocateItemsToInstallments,
  installmentState,
  type StoreOrderWithDetails,
} from "@/lib/store";
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
      if (parcel.paid_at) paidCents += parcel.paid_amount_cents || parcel.amount_cents;
    }
  }
  let pendingCents = 0;
  for (const order of orders) {
    for (const parcel of order.installments_list) {
      // Parcelas unificadas em outro pedido não são cobradas novamente.
      if (!parcel.paid_at && !parcel.merged_into_order_id) {
        pendingCents += parcel.amount_cents;
      } else if (parcel.paid_at && !parcel.merged_into_order_id && parcel.paid_amount_cents > 0) {
        // Pagamento parcial: o que faltou continua em aberto.
        pendingCents += Math.max(0, parcel.amount_cents - parcel.paid_amount_cents);
      }
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

type PillTone = "paid" | "pending" | "neutral";

const PILL_COLORS: Record<PillTone, { fill: [number, number, number]; text: [number, number, number] }> = {
  paid: { fill: [220, 245, 227], text: [21, 105, 57] },
  pending: { fill: [253, 240, 214], text: [146, 89, 8] },
  neutral: { fill: [235, 237, 241], text: [90, 99, 114] },
};

/** Pílula colorida de status; devolve a largura ocupada. */
function drawPill(doc: jsPDF, x: number, y: number, label: string, tone: PillTone): number {
  const colors = PILL_COLORS[tone];
  doc.setFontSize(7.5);
  const width = doc.getTextWidth(label) + 5;
  doc.setFillColor(colors.fill[0], colors.fill[1], colors.fill[2]);
  doc.roundedRect(x, y - 3.2, width, 4.8, 2.2, 2.2, "F");
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.text(label, x + 2.5, y);
  return width;
}

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
    const allocation = allocateItemsToInstallments(order);
    const blockHeight =
      26 + items.length * 5.5 + Math.max(1, order.installments_list.length) * 11;
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
      const numbers = allocation.byItem.find((a) => a.itemId === item.id)?.numbers ?? [];
      const label = numbers.length ? `${item.name} — [${numbers.join(", ")}]` : item.name;
      setInk(PALETTE.ink);
      doc.setFontSize(10);
      doc.text(doc.splitTextToSize(label, CONTENT_W - 40)[0] ?? label, MARGIN, y);
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
        doc.setFontSize(9.5);
        doc.text(
          order.installments > 1
            ? `Parcela ${parcel.number}/${order.installments}`
            : "Pagamento único",
          MARGIN,
          y,
        );
        doc.text(formatPrice(parcel.amount_cents), MARGIN + 45, y);
        doc.text(formatISODate(parcel.due_date), MARGIN + 75, y);
        const state = installmentState(parcel);
        const statusLabel =
          state === "transferida"
            ? "Unificada em novo pedido"
            : state === "paga"
              ? `Paga em ${formatISODate(parcel.paid_at?.slice(0, 10) ?? null)}`
              : state === "parcial"
                ? `Parcial: ${formatPrice(parcel.paid_amount_cents)}`
                : "Pendente";
        const tone: PillTone =
          state === "paga" ? "paid" : state === "transferida" ? "neutral" : "pending";
        drawPill(doc, MARGIN + 115, y, statusLabel, tone);
        doc.setFontSize(9.5);
        y += 5.5;

        // Itens cobrados neste mês
        const shares = allocation.byInstallment.get(parcel.number) ?? [];
        if (shares.length > 0 && !parcel.merged_into_order_id) {
          const line = `Itens inclusos: ${shares
            .map((s) => `${s.name} (${s.index}/${s.total})`)
            .join(", ")}.`;
          doc.setFontSize(8);
          setInk(PALETTE.soft);
          for (const chunk of doc.splitTextToSize(line, CONTENT_W - 6) as string[]) {
            ensureSpace(6);
            doc.text(chunk, MARGIN + 4, y);
            y += 4;
          }
          doc.setFontSize(9.5);
          y += 1;
        }
        if (parcel.credit_applied_cents > 0) {
          ensureSpace(8);
          doc.setFontSize(8);
          setInk(PALETTE.soft);
          doc.text(
            `(Abatido ${formatPrice(parcel.credit_applied_cents)} de crédito anterior)`,
            MARGIN + 4,
            y,
          );
          doc.setFontSize(9.5);
          y += 5;
        }
        if (parcel.carried_in_cents > 0) {
          ensureSpace(8);
          doc.setFontSize(8);
          setInk(PALETTE.soft);
          doc.text(
            `(Inclui ${formatPrice(parcel.carried_in_cents)} de pendência do mês anterior)`,
            MARGIN + 4,
            y,
          );
          doc.setFontSize(9.5);
          y += 5;
        }
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
