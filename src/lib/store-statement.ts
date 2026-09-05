import type { StoreOrderWithDetails } from "@/components/app/store-order-card";
import {
  ORDER_STATUS_LABELS,
  formatISODate,
  formatPhone,
  formatPrice,
} from "@/lib/salon";

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
  return { totalCents, paidCents, pendingCents: Math.max(0, totalCents - paidCents) };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Data/hora de criação (timestamp) em DD/MM/AAAA, sem depender do fuso da string. */
function orderDate(createdAt?: string | null): string {
  if (!createdAt) return "—";
  return formatISODate(createdAt.slice(0, 10));
}

function paymentCondition(order: StoreOrderWithDetails): string {
  return order.installments > 1 ? `Parcelado em ${order.installments}x` : "À vista";
}

function itemsRows(order: StoreOrderWithDetails): string {
  const items = order.items.length
    ? order.items
    : [
        {
          id: order.id,
          order_id: order.id,
          name: order.item_name,
          unit_price_cents: order.amount_cents,
          sort_order: 0,
        },
      ];
  return items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td class="num">${formatPrice(item.unit_price_cents)}</td></tr>`,
    )
    .join("");
}

function installmentRows(order: StoreOrderWithDetails): string {
  if (!order.installments_list.length) {
    return `<tr><td colspan="4" class="muted">Sem parcelas registradas.</td></tr>`;
  }
  return order.installments_list
    .map((parcel) => {
      const paid = Boolean(parcel.paid_at);
      const situation = paid
        ? `Paga em ${formatISODate(parcel.paid_at?.slice(0, 10) ?? null)}`
        : "Pendente";
      return `<tr>
        <td>${order.installments > 1 ? `${parcel.number}ª parcela` : "Pagamento único"}</td>
        <td class="num">${formatPrice(parcel.amount_cents)}</td>
        <td>${formatISODate(parcel.due_date)}</td>
        <td class="${paid ? "ok" : "due"}">${situation}</td>
      </tr>`;
    })
    .join("");
}

/**
 * HTML autocontido do extrato. Usa estilos próprios (não os tokens do app)
 * para o PDF sair idêntico em qualquer tema.
 */
export function buildStatementHtml(args: {
  clientName: string;
  clientPhone: string;
  orders: StoreOrderWithDetails[];
  generatedAt?: Date;
}): string {
  const totals = statementTotals(args.orders);
  const generated = args.generatedAt ?? new Date();
  const generatedLabel = `${String(generated.getDate()).padStart(2, "0")}/${String(
    generated.getMonth() + 1,
  ).padStart(2, "0")}/${generated.getFullYear()} às ${String(generated.getHours()).padStart(2, "0")}:${String(
    generated.getMinutes(),
  ).padStart(2, "0")}`;

  const blocks = args.orders
    .map(
      (order) => `<section class="order">
        <div class="order-head">
          <strong>Pedido de ${orderDate(order.created_at)}</strong>
          <span class="status">${escapeHtml(ORDER_STATUS_LABELS[order.status] ?? order.status)}</span>
        </div>
        <table class="table">
          <thead><tr><th>Item</th><th class="num">Valor unitário</th></tr></thead>
          <tbody>${itemsRows(order)}</tbody>
          <tfoot><tr><th>Total do pedido</th><th class="num">${formatPrice(order.amount_cents)}</th></tr></tfoot>
        </table>
        <p class="cond">Condição de pagamento: ${paymentCondition(order)}${
          order.delivery_date ? ` · Entrega prevista: ${formatISODate(order.delivery_date)}` : ""
        }</p>
        <table class="table">
          <thead><tr><th>Parcela</th><th class="num">Valor</th><th>Vencimento</th><th>Situação</th></tr></thead>
          <tbody>${installmentRows(order)}</tbody>
        </table>
      </section>`,
    )
    .join("");

  return `<div class="statement">
    <style>
      .statement { width: 760px; padding: 28px 32px; background: #ffffff; color: #1f2430;
        font-family: Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.45; }
      .statement h1 { margin: 0; font-size: 19px; letter-spacing: .02em; }
      .statement .head { border-bottom: 2px solid #4b5563; padding-bottom: 12px; margin-bottom: 16px; }
      .statement .head p { margin: 4px 0 0; color: #4b5563; font-size: 12px; }
      .statement .summary { display: flex; gap: 10px; margin-bottom: 18px; }
      .statement .card { flex: 1; border: 1px solid #d7dae1; border-radius: 6px; padding: 10px 12px; }
      .statement .card span { display: block; color: #6b7280; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; }
      .statement .card strong { font-size: 15px; }
      .statement .order { border: 1px solid #d7dae1; border-radius: 6px; padding: 12px 14px; margin-bottom: 14px; page-break-inside: avoid; }
      .statement .order-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      .statement .status { border: 1px solid #9ca3af; border-radius: 999px; padding: 2px 10px; font-size: 10.5px; color: #374151; }
      .statement .table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      .statement .table th, .statement .table td { border-bottom: 1px solid #e5e7eb; padding: 5px 6px; text-align: left; }
      .statement .table thead th { background: #f3f4f6; font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: #4b5563; }
      .statement .num { text-align: right; }
      .statement .cond { margin: 2px 0 10px; color: #4b5563; }
      .statement .ok { color: #15803d; }
      .statement .due { color: #b45309; }
      .statement .muted { color: #6b7280; }
      .statement .foot { margin-top: 8px; color: #6b7280; font-size: 10.5px; text-align: center; }
    </style>
    <div class="head">
      <h1>Studio Jannah Nails — Loja</h1>
      <p>Extrato do cliente: <strong>${escapeHtml(args.clientName)}</strong></p>
      <p>Telefone: ${args.clientPhone ? escapeHtml(formatPhone(args.clientPhone)) : "não informado"}</p>
      <p>Documento gerado em ${generatedLabel}</p>
    </div>
    <div class="summary">
      <div class="card"><span>Total de compras</span><strong>${formatPrice(totals.totalCents)}</strong></div>
      <div class="card"><span>Total já pago</span><strong>${formatPrice(totals.paidCents)}</strong></div>
      <div class="card"><span>Total pendente</span><strong>${formatPrice(totals.pendingCents)}</strong></div>
    </div>
    ${blocks || '<p class="muted">Nenhum pedido registrado para este cliente.</p>'}
    <p class="foot">Documento gerado automaticamente pelo painel do Studio Jannah Nails.</p>
  </div>`;
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
