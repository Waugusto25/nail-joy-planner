import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { StoreOrderInstallment, StoreOrderItem } from "@/lib/store";

export type StoreOrderWithDetails = {
  id: string;
  store_client_id: string | null;
  created_at: string | null;
  client_name: string;
  client_phone: string;
  nickname: string | null;
  item_name: string;
  amount_cents: number;
  payment_method: string | null;
  installments: number;
  delivery_date: string | null;
  status: string;
  notes: string | null;
  items: StoreOrderItem[];
  installments_list: StoreOrderInstallment[];
};

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
  const pending = order.installments_list.filter((p) => !p.paid_at);
  const nextDue = pending[0];

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

  return (
    <article className="surface-card space-y-3 p-4">
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

      <ul className="space-y-1 text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="flex items-center justify-between">
            <span>{i.name}</span>
            <span>{formatPrice(i.unit_price_cents)}</span>
          </li>
        ))}
      </ul>

      <div className="text-sm">
        <p className="font-semibold">Valor total: {formatPrice(order.amount_cents)}</p>
        <p className="text-muted-foreground">
          {order.payment_method
            ? (PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method)
            : "Pagamento a definir"}{" "}
          ·{" "}
          {order.installments > 1
            ? `${order.installments}x de ${formatPrice(order.installments_list[0]?.amount_cents ?? 0)}`
            : "À vista"}
        </p>
      </div>

      <ul className="space-y-2">
        {order.installments_list.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-end gap-2 rounded-md border border-border/60 p-2"
          >
            <span className="min-w-24 text-sm font-medium">
              {order.installments > 1 ? `Parcela ${p.number}` : "Pagamento"}
              <br />
              {formatPrice(p.amount_cents)}
            </span>
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
              className={cn("gap-1", p.paid_at && "bg-green-600 text-white hover:bg-green-700")}
              aria-label={p.paid_at ? "Marcar parcela como pendente" : "Marcar parcela como paga"}
              onClick={() => void togglePaid(p)}
            >
              <Check size={16} /> {p.paid_at ? "Paga" : "Pendente"}
            </Button>
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
    </article>
  );
}
