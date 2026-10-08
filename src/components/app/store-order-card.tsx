import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Check, ChevronDown, FileText, Plus, QrCode, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase-client";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatISODate,
  formatPhone,
  formatPrice,
  orderStatusMessage,
  whatsappLinkTo,
} from "@/lib/salon";
import { StoreStatementButton } from "@/components/app/store-statement-button";
import { StoreInvoiceExportDialog } from "@/components/app/store-invoice-export-dialog";
import { StoreOrderAddItemsDialog } from "@/components/app/store-order-add-items-dialog";
import { cn } from "@/lib/utils";
import {
  installmentState,
  isFullyPaid,
  needsCollection,
  pendingInstallments,
  removeItemInstallments,
  undoSettlement,
  type StoreOrderInstallment,
  type StoreOrderWithDetails,
} from "@/lib/store";
import { StoreInstallmentPaymentDialog } from "@/components/app/store-installment-payment-dialog";
import { confirmDestructive } from "@/components/app/confirm-destructive-dialog";
import { confirmOlderInvoices } from "@/components/app/older-invoice-warning";
import { MercadoPagoChargeDialog } from "@/components/app/mercado-pago-charge-dialog";

export type { StoreOrderWithDetails };

/** Resumo curto das parcelas: pagas x pendentes (ignora as unificadas em outro pedido). */
function installmentsSummary(order: StoreOrderWithDetails): string {
  const active = order.installments_list.filter((p) => !p.merged_into_order_id);
  if (active.length === 0) return "Sem parcelas registradas";
  const paid = active.filter((p) => p.paid_at).length;
  const pending = active.length - paid;
  const parts = [`${paid}/${active.length} paga(s)`];
  if (pending > 0) parts.push(`${pending} pendente(s)`);
  return parts.join(" • ");
}

export function StoreOrderCard({
  order,
  pixKey,
  onEdit,
}: {
  order: StoreOrderWithDetails;
  pixKey: string;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [settling, setSettling] = useState<StoreOrderInstallment | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceParcel, setInvoiceParcel] = useState<number | null>(null);
  const [mpParcel, setMpParcel] = useState<StoreOrderInstallment | null>(null);
  const pending = pendingInstallments(order.installments_list);
  const nextDue = pending[0];

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-store-orders"] });
  }

  /** Exclui um item que não veio e retira o valor dele do total e das parcelas pendentes. */
  async function removeItem(item: StoreOrderWithDetails["items"][number]) {
    const ok = await confirmDestructive({
      title: "Remover produto do pedido?",
      description: `O item "${item.name}" (${formatPrice(item.unit_price_cents)}) será removido deste pedido. O valor sai do total e as parcelas pendentes serão recalculadas. Esta ação não pode ser desfeita.`,
      confirmLabel: "Remover item",
    });
    if (!ok) return;
    setRemovingId(item.id);
    try {
      const plan = removeItemInstallments(order, item.unit_price_cents, item);
      const { error: itemError } = await supabase
        .from("store_order_items")
        .delete()
        .eq("id", item.id);
      if (itemError) throw new Error(itemError.message);

      for (const parcel of plan.update) {
        const { error } = await supabase
          .from("store_order_installments")
          .update({
            amount_cents: parcel.amount_cents,
            added_extra_cents: parcel.added_extra_cents,
          })
          .eq("id", parcel.id);
        if (error) throw new Error(error.message);
      }
      if (plan.deleteIds.length > 0) {
        const { error } = await supabase
          .from("store_order_installments")
          .delete()
          .in("id", plan.deleteIds);
        if (error) throw new Error(error.message);
      }

      const { error: orderError } = await supabase
        .from("store_orders")
        .update({ amount_cents: plan.newTotalCents, installments: plan.totalInstallments })
        .eq("id", order.id);
      if (orderError) throw new Error(orderError.message);

      if (plan.unappliedCents > 0) {
        toast.warning(
          `Item excluído. ${formatPrice(plan.unappliedCents)} já estavam pagos — confira se há valor a devolver.`,
        );
      } else {
        toast.success("Item excluído e valores recalculados.");
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o item.");
    } finally {
      setRemovingId(null);
    }
  }

  async function updateStatus(status: string) {
    const { error } = await supabase.from("store_orders").update({ status }).eq("id", order.id);
    if (error) {
      toast.error("Não foi possível atualizar o status.");
      return;
    }
    await refresh();
  }

  async function togglePaid(parcel: StoreOrderInstallment) {
    // Pagamento confirmado pelo Mercado Pago é definitivo: impede estorno acidental.
    if (parcel.paid_at && parcel.mp_status === "approved") {
      toast.info("Pagamento confirmado pelo Mercado Pago — não pode ser desfeito.");
      return;
    }
    const ok = await confirmDestructive(
      parcel.paid_at
        ? {
            title: "Voltar parcela para pendente?",
            description: `A parcela ${parcel.number} deixará de constar como paga.`,
            confirmLabel: "Voltar para pendente",
          }
        : {
            title: "Confirmar pagamento manual?",
            description: parcel.mp_payment_id
              ? `Existe uma cobrança Mercado Pago em aberto para a parcela ${parcel.number}. Só confirme se a cliente pagou de outra forma (dinheiro, cartão etc.).`
              : `A parcela ${parcel.number} será marcada como paga hoje.`,
            confirmLabel: "Marcar como paga",
          },
    );
    if (!ok) return;
    if (parcel.paid_at) {
      await revertToPending(parcel);
      return;
    }
    if (!(await confirmOlderInvoices(queryClient, order, parcel))) return;
    const { error } = await supabase
      .from("store_order_installments")
      .update({ paid_at: new Date().toISOString(), paid_amount_cents: parcel.amount_cents })
      .eq("id", parcel.id);
    if (error) {
      toast.error("Não foi possível atualizar a parcela.");
      return;
    }
    await refresh();
  }

  /** Volta a parcela para pendente estornando troco/falta lançados na parcela seguinte. */
  async function revertToPending(parcel: StoreOrderInstallment) {
    const { neighbour } = undoSettlement(order, parcel);
    if (neighbour) {
      const { id, ...values } = neighbour;
      const { error } = await supabase.from("store_order_installments").update(values).eq("id", id);
      if (error) {
        toast.error("Não foi possível estornar o ajuste da próxima parcela.");
        return;
      }
    }
    const { error } = await supabase
      .from("store_order_installments")
      .update({ paid_at: null, paid_amount_cents: 0 })
      .eq("id", parcel.id);
    if (error) {
      toast.error("Não foi possível atualizar a parcela.");
      return;
    }
    if (neighbour) toast.info("Parcela pendente; o ajuste na próxima parcela foi desfeito.");
    await refresh();
  }

  async function setDue(parcel: StoreOrderInstallment, due: string) {
    const { error } = await supabase
      .from("store_order_installments")
      .update({ due_date: due || null })
      .eq("id", parcel.id);
    if (error) {
      toast.error("Não foi possível salvar o vencimento.");
      return;
    }
    await refresh();
  }

  async function setPaidDate(parcel: StoreOrderInstallment, date: string) {
    // Apagar a data equivale a voltar para pendente: estorna também o troco/falta.
    if (!date && parcel.paid_at) {
      await revertToPending(parcel);
      return;
    }
    const { error } = await supabase
      .from("store_order_installments")
      .update({ paid_at: date ? new Date(`${date}T12:00:00`).toISOString() : null })
      .eq("id", parcel.id);
    if (error) {
      toast.error("Não foi possível salvar a data do pagamento.");
      return;
    }
    await refresh();
  }

  async function remove() {
    const ok = await confirmDestructive({
      title: "Excluir pedido da loja?",
      description: `O pedido de ${order.client_name} e todos os produtos e parcelas ligados a ele serão apagados. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir pedido",
    });
    if (!ok) return;
    const { error } = await supabase.from("store_orders").delete().eq("id", order.id);
    if (error) {
      toast.error("Não foi possível excluir o pedido.");
      return;
    }
    await refresh();
  }

  /** Arquivar só esconde da lista principal; nada é apagado. */
  async function toggleArchive() {
    const archiving = !order.archived_at;
    if (archiving && !isFullyPaid(order)) {
      toast.error("Só é possível arquivar pedidos sem parcelas em aberto.");
      return;
    }
    const { error } = await supabase
      .from("store_orders")
      .update({ archived_at: archiving ? new Date().toISOString() : null })
      .eq("id", order.id);
    if (error) {
      toast.error("Não foi possível atualizar o arquivamento.");
      return;
    }
    toast.success(archiving ? "Pedido arquivado." : "Pedido restaurado para a lista.");
    await refresh();
  }

  async function exportReport() {
    try {
      const [{ jsPDF }, { drawOrderReport, reportFileName }] = await Promise.all([
        import("jspdf"),
        import("@/lib/store-report"),
      ]);
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      drawOrderReport(doc, order);
      doc.save(reportFileName(order.client_name));
      toast.success("Relatório gerado.");
    } catch {
      toast.error("Não foi possível gerar o relatório.");
    }
  }

  function sendWhatsapp() {
    const amount = nextDue?.amount_cents ?? order.amount_cents;
    const message = orderStatusMessage(order.status, {
      amountCents: amount,
      dueDate: nextDue?.due_date ?? order.delivery_date,
      pixKey,
    });
    if (!message) {
      toast.info("Pedidos pendentes não enviam mensagem automática.");
      return;
    }
    const link = whatsappLinkTo(order.client_phone, message);
    if (!link) {
      toast.error("Cliente sem telefone válido.");
      return;
    }
    window.open(link, "_blank", "noopener");
  }

  const paymentLabel = `${
    order.payment_method
      ? (PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method)
      : "Pagamento a definir"
  } · ${
    order.installments > 1
      ? `${order.installments}x de ${formatPrice(order.installments_list[0]?.amount_cents ?? 0)}`
      : "À vista"
  }`;

  return (
    <article className="surface-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg">
            {needsCollection(order) ? (
              <span role="img" aria-label="Cobrança: parcela vencendo ou vencida" title="Fazer cobrança" className="mr-1">
                ⚠️
              </span>
            ) : null}
            {order.client_name}
            {order.nickname ? (
              <span className="text-sm font-normal text-primary"> ({order.nickname})</span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {order.client_phone ? `${formatPhone(order.client_phone)} · ` : ""}Entrega prevista:{" "}
            {order.delivery_date ? formatISODate(order.delivery_date) : "a definir"}
          </p>
        </div>
        <Badge variant="secondary">{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
      </div>

      <div className="mt-3 text-sm">
        <p className="font-semibold">Valor total: {formatPrice(order.amount_cents)}</p>
        <p className="text-muted-foreground">{paymentLabel}</p>
        <p className="text-muted-foreground">{installmentsSummary(order)}</p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-2 gap-1 px-2"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Ocultar detalhes" : "Ver detalhes / parcelas"}
        <ChevronDown
          size={16}
          className={cn("transition-transform duration-300", open && "rotate-180")}
        />
      </Button>

      <div
        className={cn(
          "grid overflow-hidden transition-all duration-300",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 space-y-3 pt-2">
          <ul className="space-y-1 text-sm">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <span>{i.name}</span>
                <span className="flex items-center gap-1">
                  {formatPrice(i.unit_price_cents)}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive h-7 w-7"
                    aria-label={`Excluir ${i.name} do pedido`}
                    title="Excluir item e retirar o valor dos cálculos"
                    disabled={removingId === i.id}
                    onClick={() => void removeItem(i)}
                  >
                    <X size={14} />
                  </Button>
                </span>
              </li>
            ))}
          </ul>

          <ul className="space-y-2">
            {order.installments_list.map((p) => {
              const state = installmentState(p);
              return (
              <li
                key={p.id}
                className={cn(
                  "flex flex-wrap items-end gap-2 rounded-md border border-border/60 p-2",
                  p.merged_into_order_id && "opacity-70",
                )}
              >
                <span className="min-w-24 text-sm font-medium">
                  {order.installments > 1 ? `Parcela ${p.number}` : "Pagamento"}
                  <br />
                  {formatPrice(p.amount_cents)}
                  {state === "parcial" ? (
                    <span className="block text-xs font-normal text-amber-600">
                      Parcialmente paga (Pago: {formatPrice(p.paid_amount_cents)})
                    </span>
                  ) : null}
                  {p.credit_applied_cents > 0 ? (
                    <span className="block text-xs font-normal text-green-700">
                      (Abatido {formatPrice(p.credit_applied_cents)} de crédito anterior)
                    </span>
                  ) : null}
                  {p.carried_in_cents > 0 ? (
                    <span className="block text-xs font-normal text-amber-600">
                      (Inclui {formatPrice(p.carried_in_cents)} de pendência do mês anterior)
                    </span>
                  ) : null}
                  {p.merged_extra_cents > 0 ? (
                    <span className="block text-xs font-normal text-primary">
                      (Inclui {formatPrice(p.merged_extra_cents)} do pedido anterior)
                    </span>
                  ) : null}
                  {p.added_extra_cents > 0 ? (
                    <span className="block text-xs font-normal text-primary">
                      (Inclui {formatPrice(p.added_extra_cents)} do item acrescentado)
                    </span>
                  ) : null}
                  {p.merged_into_order_id ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      Unificada / transferida para novo pedido
                    </span>
                  ) : null}
                </span>
                {p.merged_into_order_id ? null : (
                  <>
                    <label className="text-xs text-muted-foreground">
                      Vencimento
                      <Input
                        type="date"
                        className="h-9"
                        value={p.due_date ?? ""}
                        onChange={(e) => void setDue(p, e.target.value)}
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Pagamento
                      <Input
                        type="date"
                        className="h-9"
                        value={p.paid_at ? p.paid_at.slice(0, 10) : ""}
                        onChange={(e) => void setPaidDate(p, e.target.value)}
                      />
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setSettling(p)}
                    >
                      <Wallet size={16} /> Dar baixa
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9"
                      aria-label={`Exportar fatura da parcela ${p.number} em PDF`}
                      title="Exportar fatura deste mês (PDF)"
                      onClick={() => {
                        setInvoiceParcel(p.number);
                        setInvoiceOpen(true);
                      }}
                    >
                      <FileText size={16} />
                    </Button>
                    {!p.paid_at && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        title="Gerar Cobrança Mercado Pago"
                        onClick={() => setMpParcel(p)}
                      >
                        <QrCode size={16} /> {p.mp_payment_id ? "Cobrança MP" : "Gerar Cobrança Mercado Pago"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={p.paid_at ? "default" : "outline"}
                      className={cn(
                        "gap-1",
                        state === "paga" && "bg-green-600 text-white hover:bg-green-700",
                        state === "parcial" && "bg-amber-500 text-white hover:bg-amber-600",
                      )}
                      aria-label={
                        p.paid_at ? "Marcar parcela como pendente" : "Marcar parcela como paga"
                      }
                      disabled={Boolean(p.paid_at) && p.mp_status === "approved"}
                      title={
                        p.paid_at && p.mp_status === "approved"
                          ? "Pago via Mercado Pago (travado)"
                          : undefined
                      }
                      onClick={() => void togglePaid(p)}
                    >
                      <Check size={16} />{" "}
                      {state === "paga"
                        ? p.mp_status === "approved"
                          ? "Paga (Mercado Pago)"
                          : "Paga"
                        : state === "parcial"
                          ? "Parcial"
                          : "Pendente"}
                    </Button>
                  </>
                )}
              </li>
              );
            })}
          </ul>


          {order.notes ? <p className="text-xs text-muted-foreground">{order.notes}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Alterar status do pedido"
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              value={order.status}
              onChange={(e) => void updateStatus(e.target.value)}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              className="bg-green-600 text-white hover:bg-green-700"
              disabled={order.status === "pendente"}
              onClick={sendWhatsapp}
            >
              WhatsApp
            </Button>
            {/* Sempre disponível: a conta da cliente continua aberta para novas compras. */}
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setAddOpen(true)}>
              <Plus size={16} /> Adicionar Produto a este Pedido
            </Button>
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Editar
            </Button>
            <StoreStatementButton
              clientId={order.store_client_id}
              clientName={order.client_name}
              clientPhone={order.client_phone}
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                setInvoiceParcel(null);
                setInvoiceOpen(true);
              }}
            >
              <FileText size={16} /> Exportar Fatura (PDF)
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={!order.archived_at && !isFullyPaid(order)}
              title={!order.archived_at && !isFullyPaid(order) ? "Quite todas as parcelas para arquivar" : undefined}
              onClick={() => void toggleArchive()}
            >
              <Archive size={16} /> {order.archived_at ? "Desarquivar" : "Arquivar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void remove()}>
              Excluir
            </Button>
            <Button size="sm" variant="outline" onClick={() => void exportReport()}>
              <span aria-hidden>📝</span> Relatório
            </Button>
          </div>
        </div>
      </div>

      <StoreOrderAddItemsDialog order={order} open={addOpen} onOpenChange={setAddOpen} />
      <StoreInvoiceExportDialog
        order={order}
        pixKey={pixKey}
        open={invoiceOpen}
        onOpenChange={(v) => {
          setInvoiceOpen(v);
          if (!v) setInvoiceParcel(null);
        }}
        initialParcelNumber={invoiceParcel}
      />
      <MercadoPagoChargeDialog
        parcel={mpParcel}
        onOpenChange={(v) => {
          if (!v) setMpParcel(null);
        }}
      />
      <StoreInstallmentPaymentDialog
        order={order}
        parcel={settling}
        open={settling !== null}
        onOpenChange={(v) => {
          if (!v) setSettling(null);
        }}
      />
    </article>
  );
}
