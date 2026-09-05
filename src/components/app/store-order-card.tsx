import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
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
import { StoreOrderAddItemsDialog } from "@/components/app/store-order-add-items-dialog";
import { cn } from "@/lib/utils";
import { pendingInstallments, type StoreOrderInstallment, type StoreOrderWithDetails } from "@/lib/store";

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
  const pending = pendingInstallments(order.installments_list);
  const nextDue = pending[0];
  // Pedido em aberto: ainda em andamento ou com saldo devedor.
  const isOpenOrder =
    order.status === "pendente" || order.status === "encomendado" || pending.length > 0;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-store-orders"] });
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
    const { error } = await supabase
      .from("store_order_installments")
      .update({ paid_at: parcel.paid_at ? null : new Date().toISOString() })
      .eq("id", parcel.id);
    if (error) {
      toast.error("Não foi possível atualizar a parcela.");
      return;
    }
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
    if (!window.confirm("Excluir este pedido da loja?")) return;
    const { error } = await supabase.from("store_orders").delete().eq("id", order.id);
    if (error) {
      toast.error("Não foi possível excluir o pedido.");
      return;
    }
    await refresh();
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
              <li key={i.id} className="flex items-center justify-between">
                <span>{i.name}</span>
                <span>{formatPrice(i.unit_price_cents)}</span>
              </li>
            ))}
          </ul>

          <ul className="space-y-2">
            {order.installments_list.map((p) => (
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
                  {p.merged_extra_cents > 0 ? (
                    <span className="block text-xs font-normal text-primary">
                      (Inclui {formatPrice(p.merged_extra_cents)} do pedido anterior)
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
                      variant={p.paid_at ? "default" : "outline"}
                      className={cn(
                        "gap-1",
                        p.paid_at && "bg-green-600 text-white hover:bg-green-700",
                      )}
                      aria-label={
                        p.paid_at ? "Marcar parcela como pendente" : "Marcar parcela como paga"
                      }
                      onClick={() => void togglePaid(p)}
                    >
                      <Check size={16} /> {p.paid_at ? "Paga" : "Pendente"}
                    </Button>
                  </>
                )}
              </li>
            ))}
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
            {isOpenOrder ? (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setAddOpen(true)}>
                <Plus size={16} /> Adicionar Produto a este Pedido
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Editar
            </Button>
            <StoreStatementButton
              clientId={order.store_client_id}
              clientName={order.client_name}
              clientPhone={order.client_phone}
            />

            <Button size="sm" variant="ghost" onClick={() => void remove()}>
              Excluir
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
