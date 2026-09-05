import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase-client";
import { ORDER_STATUSES, PAYMENT_METHODS, formatPrice, splitInstallments } from "@/lib/salon";
import { displayName, fetchStoreClients } from "@/lib/store";
import type { StoreOrderWithDetails } from "@/components/app/store-order-card";

type ItemRow = { key: string; name: string; price: string };

function newItem(): ItemRow {
  return { key: crypto.randomUUID(), name: "", price: "" };
}

function toCents(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function toInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function StoreOrderForm({
  editing,
  onDone,
}: {
  editing: StoreOrderWithDetails | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const clients = useQuery({ queryKey: ["store-clients"], queryFn: fetchStoreClients });

  const [clientId, setClientId] = useState("");
  const [items, setItems] = useState<ItemRow[]>([newItem()]);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [installments, setInstallments] = useState("1");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [status, setStatus] = useState("pendente");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setClientId(editing.store_client_id ?? "");
    setItems(
      editing.items.length > 0
        ? editing.items.map((i) => ({
            key: i.id,
            name: i.name,
            price: toInput(i.unit_price_cents),
          }))
        : [newItem()],
    );
    setPaymentMethod(editing.payment_method ?? "pix");
    setInstallments(String(editing.installments ?? 1));
    setDeliveryDate(editing.delivery_date ?? "");
    setStatus(editing.status);
    setNotes(editing.notes ?? "");
  }, [editing]);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + toCents(i.price), 0),
    [items],
  );
  const parcels = splitInstallments(total, Number(installments) || 1);

  function reset() {
    setClientId("");
    setItems([newItem()]);
    setPaymentMethod("pix");
    setInstallments("1");
    setDeliveryDate("");
    setStatus("pendente");
    setNotes("");
  }

  async function save() {
    const client = (clients.data ?? []).find((c) => c.id === clientId);
    if (!client) {
      toast.error("Selecione um cliente da loja.");
      return;
    }
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      toast.error("Adicione pelo menos um item ao pedido.");
      return;
    }
    setSaving(true);
    try {
      const count = Math.max(1, Number(installments) || 1);
      const payload = {
        store_client_id: client.id,
        client_name: client.full_name,
        client_phone: client.phone,
        item_name: validItems.map((i) => i.name.trim()).join(", "),
        amount_cents: total,
        payment_method: paymentMethod || null,
        installments: count,
        delivery_date: deliveryDate || null,
        status,
        notes: notes.trim() || null,
      };

      let orderId = editing?.id ?? "";
      if (editing) {
        const { error } = await supabase.from("store_orders").update(payload).eq("id", editing.id);
        if (error) throw new Error(error.message);
        await supabase.from("store_order_items").delete().eq("order_id", editing.id);
      } else {
        const { data, error } = await supabase
          .from("store_orders")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        orderId = data.id;
      }

      const { error: itemsError } = await supabase.from("store_order_items").insert(
        validItems.map((i, index) => ({
          order_id: orderId,
          name: i.name.trim(),
          unit_price_cents: toCents(i.price),
          sort_order: index,
        })),
      );
      if (itemsError) throw new Error(itemsError.message);

      // Mantém as parcelas alinhadas ao total, preservando pagamentos já registrados.
      const paid = new Map(
        (editing?.installments_list ?? [])
          .filter((p) => p.paid_at)
          .map((p) => [p.number, { paid_at: p.paid_at, due_date: p.due_date }]),
      );
      await supabase.from("store_order_installments").delete().eq("order_id", orderId);
      const amounts = splitInstallments(total, count);
      const { error: parcelsError } = await supabase.from("store_order_installments").insert(
        amounts.map((amount, index) => ({
          order_id: orderId,
          number: index + 1,
          amount_cents: amount,
          due_date: paid.get(index + 1)?.due_date ?? deliveryDate || null,
          paid_at: paid.get(index + 1)?.paid_at ?? null,
        })),
      );
      if (parcelsError) throw new Error(parcelsError.message);

      toast.success(editing ? "Pedido atualizado." : "Pedido registrado.");
      reset();
      onDone();
      await queryClient.invalidateQueries({ queryKey: ["admin-store-orders"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o pedido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface-card space-y-4 p-5">
      <h3 className="font-display text-lg">{editing ? "Editar pedido" : "Novo pedido da loja"}</h3>

      <div className="space-y-1">
        <Label htmlFor="order-client">Cliente da loja</Label>
        <select
          id="order-client"
          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="">Selecione um cliente cadastrado</option>
          {(clients.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {displayName(c)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Os clientes vêm da sub-aba Clientes LOJA, com nome, telefone e apelido.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Itens do pedido</Label>
        {items.map((item, index) => (
          <div key={item.key} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Input
                aria-label={`Nome do item ${index + 1}`}
                value={item.name}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((p) => (p.key === item.key ? { ...p, name: e.target.value } : p)),
                  )
                }
                placeholder="Ex: Esmalte gel rosa"
              />
            </div>
            <div className="w-32 space-y-1">
              <Input
                aria-label={`Valor do item ${index + 1}`}
                inputMode="decimal"
                value={item.price}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((p) => (p.key === item.key ? { ...p, price: e.target.value } : p)),
                  )
                }
                placeholder="89,90"
              />
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remover item ${index + 1}`}
              disabled={items.length === 1}
              onClick={() => setItems((prev) => prev.filter((p) => p.key !== item.key))}
            >
              <X size={16} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => setItems((prev) => [...prev, newItem()])}
        >
          <Plus size={16} /> Adicionar item
        </Button>
      </div>

      <p className="font-display text-lg">Valor a Receber: {formatPrice(total)}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="order-payment">Forma de pagamento</Label>
          <select
            id="order-payment"
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="order-installments">Condição de pagamento</Label>
          <select
            id="order-installments"
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            value={installments}
            onChange={(e) => setInstallments(e.target.value)}
          >
            <option value="1">À vista</option>
            {[2, 3, 4, 5, 6, 10, 12].map((n) => (
              <option key={n} value={String(n)}>
                {n}x parcelas
              </option>
            ))}
          </select>
          {parcels.length > 1 ? (
            <p className="text-xs text-muted-foreground">
              {parcels.length}x de {formatPrice(parcels[0] ?? 0)} (última:{" "}
              {formatPrice(parcels[parcels.length - 1] ?? 0)})
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <Label htmlFor="order-delivery">Data prevista de entrega</Label>
          <Input
            id="order-delivery"
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="order-status">Status do pedido</Label>
          <select
            id="order-status"
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="order-notes">Observações</Label>
          <Textarea
            id="order-notes"
            maxLength={280}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Cor, tamanho, detalhes da encomenda..."
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? "Salvando..." : editing ? "Salvar alterações" : "Registrar pedido"}
        </Button>
        {editing ? (
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onDone();
            }}
          >
            Cancelar edição
          </Button>
        ) : null}
      </div>
    </section>
  );
}
