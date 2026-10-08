import type { jsPDF } from "jspdf";

import { formatISODate, formatPrice } from "@/lib/salon";
import type { StoreOrderWithDetails } from "@/lib/store";

const M = 14;
const PAGE_H = 297;

export type ReportRange = { from: string; to: string };

export type ReportRow = {
  client: string;
  sold: number;
  paid: number;
  pending: number;
};

export type ReportTotals = { sold: number; paid: number; pending: number; rows: ReportRow[] };

/** Comparação de strings "YYYY-MM-DD" — sem Date para não sofrer com fuso. */
const inRange = (day: string | null | undefined, r: ReportRange): boolean =>
  Boolean(day && day >= r.from && day <= r.to);

/**
 * Vendido = pedidos criados no período; Pago = parcelas quitadas no período;
 * A receber = saldo das parcelas em aberto que vencem no período.
 */
export function computeReport(orders: StoreOrderWithDetails[], range: ReportRange): ReportTotals {
  const byClient = new Map<string, ReportRow>();
  for (const o of orders) {
    const row = byClient.get(o.client_name) ?? { client: o.client_name, sold: 0, paid: 0, pending: 0 };
    if (inRange(o.created_at?.slice(0, 10), range)) row.sold += o.amount_cents;
    for (const p of o.installments_list) {
      if (p.merged_into_order_id) continue;
      if (p.paid_at && inRange(p.paid_at.slice(0, 10), range)) {
        row.paid += p.paid_amount_cents || p.amount_cents;
      } else if (!p.paid_at && inRange(p.due_date, range)) {
        row.pending += Math.max(0, p.amount_cents - (p.paid_amount_cents || 0));
      }
    }
    if (row.sold || row.paid || row.pending) byClient.set(o.client_name, row);
  }
  const rows = [...byClient.values()].sort((a, b) => a.client.localeCompare(b.client, "pt-BR"));
  return {
    rows,
    sold: rows.reduce((s, r) => s + r.sold, 0),
    paid: rows.reduce((s, r) => s + r.paid, 0),
    pending: rows.reduce((s, r) => s + r.pending, 0),
  };
}

/** Divide o período em meses-calendário (cada um recortado ao intervalo escolhido). */
export function splitByMonth(range: ReportRange): ReportRange[] {
  const out: ReportRange[] = [];
  let y = Number(range.from.slice(0, 4));
  let m = Number(range.from.slice(5, 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  for (;;) {
    const first = `${y}-${pad(m)}-01`;
    const last = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
    if (first > range.to) break;
    out.push({ from: first < range.from ? range.from : first, to: last > range.to ? range.to : last });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function drawGeneralReport(doc: jsPDF, totals: ReportTotals, range: ReportRange): void {
  let y = M + 2;
  doc.setTextColor(31, 36, 48);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Studio Jannah Nails — Relatório geral da Loja", M, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Período: ${formatISODate(range.from)} a ${formatISODate(range.to)}`, M, y);
  y += 10;

  const boxes: [string, number, [number, number, number]][] = [
    ["Total vendido", totals.sold, [31, 36, 48]],
    ["Total pago", totals.paid, [21, 105, 57]],
    ["Total a receber", totals.pending, [160, 40, 40]],
  ];
  boxes.forEach(([label, value, c], i) => {
    const x = M + i * 61;
    doc.setDrawColor(205, 210, 219);
    doc.roundedRect(x, y, 58, 18, 2, 2);
    doc.setFontSize(9);
    doc.setTextColor(90, 96, 110);
    doc.text(label, x + 4, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(formatPrice(value), x + 4, y + 14);
    doc.setFont("helvetica", "normal");
  });
  y += 28;

  const cols = { c: M, s: 110, p: 145, r: 180 } as const;
  const header = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(31, 36, 48);
    doc.text("Cliente", cols.c, y);
    doc.text("Vendido", cols.s, y);
    doc.text("Pago", cols.p, y);
    doc.text("A receber", cols.r, y);
    y += 2;
    doc.line(M, y, 196, y);
    y += 5;
    doc.setFont("helvetica", "normal");
  };
  header();
  if (!totals.rows.length) doc.text("Nenhum movimento neste período.", M, y);
  for (const r of totals.rows) {
    if (y > PAGE_H - M) {
      doc.addPage();
      y = M + 2;
      header();
    }
    doc.text(doc.splitTextToSize(r.client, 92)[0] as string, cols.c, y);
    doc.text(formatPrice(r.sold), cols.s, y);
    doc.text(formatPrice(r.paid), cols.p, y);
    doc.text(formatPrice(r.pending), cols.r, y);
    y += 6;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 126, 140);
    doc.text(`Página ${i} de ${pages}`, 196, PAGE_H - 6, { align: "right" });
  }
}
