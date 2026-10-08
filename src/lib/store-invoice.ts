import type { jsPDF } from "jspdf";

import {
  allocateItemsToInstallments,
  installmentState,
  type StoreOrderInstallment,
  type StoreOrderWithDetails,
} from "@/lib/store";
import { formatISODate, formatPhone, formatPrice } from "@/lib/salon";
import { BOLETO_FEE_CENTS, BOLETO_FEE_NOTICE } from "@/lib/mercado-pago-fees";

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
  const totalCount = Math.max(all.length || order.installments, ...all.map((p) => p.number));
  // "Modelo Boleto Mercado Pago": só quando a cobrança gerada foi boleto.
  const isBoleto = parcel.mp_method === "boleto" && Boolean(parcel.boleto_linha_digitavel);
  const feeCents = isBoleto ? BOLETO_FEE_CENTS : 0;

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
  doc.text(isBoleto ? "BOLETO MERCADO PAGO" : "FATURA MENSAL", MARGIN, y + 4);
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
    [isBoleto ? "Valor do boleto" : "Valor da fatura", formatPrice(parcel.amount_cents + feeCents)],
    [
      isBoleto ? "Vencimento do boleto" : "Vencimento",
      formatISODate(isBoleto && parcel.boleto_expires_on ? parcel.boleto_expires_on : parcel.due_date),
    ],
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
  if (isBoleto) {
    ensureSpace(8);
    doc.setFontSize(10);
    setInk(INK);
    doc.text("Taxa de emissão de boleto bancário", MARGIN, y);
    doc.text(formatPrice(BOLETO_FEE_CENTS), PAGE_W - MARGIN, y, { align: "right" });
    y += 5.5;
  }
  ensureSpace(10);
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setInk(INK);
  doc.text(isBoleto ? "Total do boleto" : "Total da fatura", MARGIN, y);
  doc.text(
    formatPrice((shares.length ? itemsTotal : parcel.amount_cents) + feeCents),
    PAGE_W - MARGIN,
    y,
    { align: "right" },
  );
  doc.setFont("helvetica", "normal");
  y += 8;

  if (isBoleto) {
    const notice = doc.splitTextToSize(BOLETO_FEE_NOTICE, CONTENT_W - 8) as string[];
    const h = notice.length * 4.6 + 8;
    ensureSpace(h + 4);
    doc.setDrawColor(INK[0], INK[1], INK[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN, y, CONTENT_W, h, 1.5, 1.5);
    doc.setLineWidth(0.3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setInk(INK);
    let ny = y + 6;
    for (const line of notice) {
      doc.text(line, MARGIN + 4, ny);
      ny += 4.6;
    }
    doc.setFont("helvetica", "normal");
    y += h + 6;
  }

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
    : "Nenhuma parcela vencida após esta.";

  const lines: string[] = [];
  lines.push("Próximas parcelas:");
  lines.push(...(doc.splitTextToSize(upcomingLine, CONTENT_W - 8) as string[]));
  // Chave Pix fixa só aparece quando não há cobrança Mercado Pago gerada.
  if (args.pixKey && !parcel.pix_copia_e_cola && !parcel.boleto_linha_digitavel) {
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

  drawMercadoPagoBlock(doc, parcel, y, ensureSpace, (v) => (y = v), () => y);

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

/** Bloco de pagamento Mercado Pago: QR Code + copia e cola, ou linha digitável do boleto. */
function drawMercadoPagoBlock(
  doc: jsPDF,
  parcel: StoreOrderInstallment,
  startY: number,
  ensureSpace: (n: number) => void,
  setY: (v: number) => void,
  getY: () => number,
): void {
  setY(startY);
  if (parcel.pix_copia_e_cola) {
    const qr = 48;
    const code = doc.splitTextToSize(parcel.pix_copia_e_cola, CONTENT_W - 8) as string[];
    const h = (parcel.pix_qr_code_base64 ? qr + 6 : 0) + code.length * 3.8 + 16;
    ensureSpace(h);
    let y = getY();
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.roundedRect(MARGIN, y, CONTENT_W, h, 1.5, 1.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("Pague com Pix — escaneie o QR Code", PAGE_W / 2, y + 6, { align: "center" });
    y += 9;
    if (parcel.pix_qr_code_base64) {
      try {
        doc.addImage(`data:image/png;base64,${parcel.pix_qr_code_base64}`, "PNG", (PAGE_W - qr) / 2, y, qr, qr);
      } catch {
        /* imagem inválida: segue apenas com o código copia e cola */
      }
      y += qr + 4;
    }
    doc.setFontSize(8.5);
    doc.text("Pix Copia e Cola:", MARGIN + 4, y);
    y += 4;
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(SOFT[0], SOFT[1], SOFT[2]);
    for (const line of code) {
      doc.text(line, MARGIN + 4, y);
      y += 3.8;
    }
    doc.setFont("helvetica", "normal");
    setY(getY() + h + 6);
  }
  if (parcel.boleto_linha_digitavel) {
    const boxH = parcel.boleto_pdf_url ? 38 : 20;
    ensureSpace(boxH + 6);
    let y = getY();
    doc.setDrawColor(INK[0], INK[1], INK[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 1.5, 1.5);
    doc.setLineWidth(0.3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("Boleto Mercado Pago — linha digitável:", MARGIN + 4, y + 6);
    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    const code = doc.splitTextToSize(parcel.boleto_linha_digitavel, CONTENT_W - 8) as string[];
    doc.text(code[0] ?? parcel.boleto_linha_digitavel, MARGIN + 4, y + 13);
    doc.setFont("helvetica", "normal");
    if (parcel.boleto_pdf_url) {
      // Botão de destaque: o boleto oficial traz código de barras e QR Code Pix.
      const btnY = y + 18;
      doc.setFillColor(INK[0], INK[1], INK[2]);
      doc.roundedRect(MARGIN + 4, btnY, CONTENT_W - 8, 10, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("BAIXAR BOLETO OFICIAL (código de barras + QR Code)", PAGE_W / 2, btnY + 6.5, {
        align: "center",
      });
      doc.link(MARGIN + 4, btnY, CONTENT_W - 8, 10, { url: parcel.boleto_pdf_url });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(SOFT[0], SOFT[1], SOFT[2]);
      doc.textWithLink(parcel.boleto_pdf_url.slice(0, 110), MARGIN + 4, btnY + 15, {
        url: parcel.boleto_pdf_url,
      });
    }
    y += boxH + 6;
    setY(y);
  }
}
