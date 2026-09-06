import type { jsPDF } from "jspdf";

import {
  allocateItemsToInstallments,
  installmentState,
  type StoreOrderInstallment,
  type StoreOrderWithDetails,
} from "@/lib/store";
import { formatISODate, formatPhone, formatPrice } from "@/lib/salon";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK: [number, number, number] = [31, 36, 48];
const SOFT: [number, number, number] = [90, 99, 114];
const LINE: [number, number, number] = [205, 210, 219];

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "setembro/2026" a partir de "AAAA-MM-DD", sem conversão de fuso. */
export function monthYearLabel(iso: string | null): string {
  if (!iso) return "sem vencimento";
  const [year, month] = iso.slice(0, 10).split("-");
  const index = Number(month) - 1;
  return `${MONTHS[index] ?? month}/${year}`;
}

export function invoiceFileName(clientName: string, number: number): string {
  const slug = clientName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `fatura-${slug || "cliente"}-parcela-${number}.pdf`;
}

/** Parcelas cobráveis, em ordem — base de "próximas parcelas". */
export function invoiceableInstallments(order: StoreOrderWithDetails): StoreOrderInstallment[] {
  return order.installments_list
    .filter((p) => !p.merged_into_order_id)
    .sort((a, b) => a.number - b.number);
}

function statusLabel(parcel: StoreOrderInstallment): string {
  const state = installmentState(parcel);
  if (state === "paga") return "PAGO";
  if (state === "parcial") return "PARCIAL";
  return "PENDENTE";
}

/** Desenha a fatura de uma única parcela (mês) do pedido. */
export function drawInvoice(
  doc: jsPDF,
  args: {
    clientName: string;
    clientPhone: string;
    order: StoreOrderWithDetails;
    parcel: StoreOrderInstallment;
    pixKey?: string;
    generatedAt?: Date;
  },
): void {
  const { order, parcel } = args;
  const allocation = allocateItemsToInstallments(order);
  const shares = allocation.byInstallment.get(parcel.number) ?? [];
  const all = invoiceableInstallments(order);
  const totalCount = all.length || order.installments;

  const setInk = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  let y = MARGIN;
  const ensureSpace = (needed: number) => {
    if (y + needed <= PAGE_H - MARGIN) return;
    doc.addPage();
    y = MARGIN;
  };

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setInk(INK);
  doc.text("FATURA MENSAL", MARGIN, y + 4);
  doc.setFontSize(11);
  doc.text(
    `FATURA — PARCELA ${parcel.number}/${totalCount}`,
    PAGE_W - MARGIN,
    y + 4,
    { align: "right" },
  );
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setInk(SOFT);
  doc.text(`Studio Jannah Nails — Loja · Vencimento em ${monthYearLabel(parcel.due_date)}`, MARGIN, y);
  y += 5;
  doc.text(`Cliente: ${args.clientName}`, MARGIN, y);
  y += 5;
  doc.text(
    `Telefone: ${args.clientPhone ? formatPhone(args.clientPhone) : "não informado"}`,
    MARGIN,
    y,
  );
  y += 4;
  doc.setDrawColor(SOFT[0], SOFT[1], SOFT[2]);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  // Métricas do mês
  const cardW = (CONTENT_W - 8) / 3;
  const cards: [string, string][] = [
    ["Valor da fatura", formatPrice(parcel.amount_cents)],
    ["Vencimento", formatISODate(parcel.due_date)],
    ["Status", statusLabel(parcel)],
  ];
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.3);
  cards.forEach(([label, value], index) => {
    const x = MARGIN + index * (cardW + 4);
    doc.roundedRect(x, y, cardW, 16, 1.5, 1.5);
    doc.setFontSize(8);
    setInk(SOFT);
    doc.text(label.toUpperCase(), x + 3, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    setInk(INK);
    doc.text(value, x + 3, y + 12.5);
    doc.setFont("helvetica", "normal");
  });
  y += 24;

  // Produtos com fração cobrada nesta parcela
  doc.setFontSize(8);
  setInk(SOFT);
  doc.text("PRODUTO", MARGIN, y);
  doc.text("VALOR NESTE MÊS", PAGE_W - MARGIN, y, { align: "right" });
  y += 1.5;
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 4;

  let itemsTotal = 0;
  if (shares.length === 0) {
    doc.setFontSize(10);
    setInk(SOFT);
    doc.text("Sem produtos vinculados a esta parcela.", MARGIN, y);
    y += 6;
  } else {
    doc.setFontSize(10);
    for (const share of shares) {
      ensureSpace(8);
      setInk(INK);
      const label = `${share.name} (${share.index}/${share.total})`;
      doc.text(doc.splitTextToSize(label, CONTENT_W - 45)[0] ?? label, MARGIN, y);
      doc.text(formatPrice(share.amountCents), PAGE_W - MARGIN, y, { align: "right" });
      itemsTotal += share.amountCents;
      y += 5.5;
    }
  }
  ensureSpace(10);
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setInk(INK);
  doc.text("Total da fatura", MARGIN, y);
  doc.text(formatPrice(shares.length ? itemsTotal : parcel.amount_cents), PAGE_W - MARGIN, y, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  y += 8;

  // Ajustes que compõem o valor do mês
  const notes: string[] = [];
  if (parcel.credit_applied_cents > 0)
    notes.push(`Abatido ${formatPrice(parcel.credit_applied_cents)} de crédito anterior.`);
  if (parcel.carried_in_cents > 0)
    notes.push(`Inclui ${formatPrice(parcel.carried_in_cents)} de pendência do mês anterior.`);
  if (parcel.merged_extra_cents > 0)
    notes.push(`Inclui ${formatPrice(parcel.merged_extra_cents)} do pedido anterior.`);
  if (parcel.paid_amount_cents > 0 && !parcel.paid_at)
    notes.push(`Pago parcialmente: ${formatPrice(parcel.paid_amount_cents)}.`);
  // Quando a soma dos produtos não fecha com o valor cobrado (ajustes manuais,
  // pedidos antigos sem vínculo), a diferença é declarada em vez de escondida.
  if (shares.length > 0 && itemsTotal !== parcel.amount_cents)
    notes.push(
      `Valor cobrado na parcela: ${formatPrice(parcel.amount_cents)} (diferença de ${formatPrice(Math.abs(parcel.amount_cents - itemsTotal))} referente a ajustes desta parcela).`,
    );
  if (notes.length > 0) {
    doc.setFontSize(8.5);
    setInk(SOFT);
    for (const note of notes) {
      ensureSpace(6);
      doc.text(note, MARGIN, y);
      y += 4.5;
    }
    y += 3;
  }

  // Rodapé financeiro: próximas parcelas + Pix
  const upcoming = all.filter((p) => p.number > parcel.number && !p.paid_at);
  const upcomingLine = upcoming.length
    ? upcoming
        .map(
          (p) =>
            `Parcela ${p.number}/${totalCount} em ${formatISODate(p.due_date)} — ${formatPrice(p.amount_cents)}`,
        )
        .join("  |  ")
    : "Nenhuma parcela vincenda após esta.";

  const lines: string[] = [];
  lines.push("Próximas parcelas:");
  lines.push(...(doc.splitTextToSize(upcomingLine, CONTENT_W - 8) as string[]));
  if (args.pixKey) {
    lines.push("");
    lines.push("Pagamento via Pix:");
    lines.push(...(doc.splitTextToSize(args.pixKey, CONTENT_W - 8) as string[]));
  }
  const boxH = lines.length * 4.6 + 8;
  ensureSpace(boxH + 4);
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 1.5, 1.5);
  let ty = y + 6;
  doc.setFontSize(8.5);
  for (const line of lines) {
    setInk(line.endsWith(":") ? INK : SOFT);
    doc.setFont("helvetica", line.endsWith(":") ? "bold" : "normal");
    doc.text(line, MARGIN + 4, ty);
    ty += 4.6;
  }
  doc.setFont("helvetica", "normal");
  y += boxH + 6;

  const generated = args.generatedAt ?? new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  doc.setFontSize(8);
  setInk(SOFT);
  doc.text(
    `Documento gerado em ${p(generated.getDate())}/${p(generated.getMonth() + 1)}/${generated.getFullYear()} · Studio Jannah Nails — Loja`,
    PAGE_W / 2,
    PAGE_H - 8,
    { align: "center" },
  );
}
