import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  formatDateTime,
  formatInstallments,
  formatPhone,
  formatPrice,
  onlyDigits,
  whatsappLinkTo,
} from "@/lib/salon";

type OrderForm = {
  client_name: string;
  client_phone: string;
  item_name: string;
  amount: string;
  payment_method: string;
  installments: string;
  delivery_date: string;
  status: string;
  notes: string;
};

const EMPTY: OrderForm = {
  client_name: "",
  client_phone: "",
  item_name: "",
  amount: "",
  payment_method: "pix",
  installments: "1",
  delivery_date: "",
  status: "pendente",
  notes: "",
};

function toCents(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function StoreOrdersTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OrderForm>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const orders = useQuery({
    queryKey: ["admin-store-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  function set<K extends keyof OrderForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!form.client_name.trim() || !form.item_name.trim()) {
      toast.error("Informe o nome da cliente e o produto.");
      return;
    }
    const payload = {
      client_name: form.client_name.trim(),
      client_phone: onlyDigits(form.client_phone),
      item_name: form.item_name.trim(),
      amount_cents: toCents(form.amount),
      payment_method: form.payment_method || null,
      installments: Math.max(1, Number(form.installments) || 1),
      delivery_date: form.delivery_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    const { error } = editingId
      ? await supabase.from("store_orders").update(payload).eq("id", editingId)
      : await supabase.from("store_orders").insert(payload);
    if (error) {
      toast.error("Não foi possível salvar o pedido.");
      return;
    }
    toast.success(editingId ? "Pedido atualizado." : "Pedido registrado.");
    setForm(EMPTY);
    setEditingId(null);
    await queryClient.invalidateQueries({ queryKey: ["admin-store-orders"] });
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("store_orders").update({ status }).eq("id", id);
    if (error) {
      toast.error("Não foi possível atualizar o status.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["admin-store-orders"] });
  }

  async function remove(id: string) {
    await supabase.from("store_orders").delete().eq("id", id);
    if (editingId === id) {
      setEditingId(null);
      setForm(EMPTY);
    }
    await queryClient.invalidateQueries({ queryKey: ["admin-store-orders"] });
  }

  const rows = orders.data ?? [];
  const pendingTotal = rows
    .filter((o) => o.status !== "entregue")
    .reduce((sum, o) => sum + Number(o.amount_cents ?? 0), 0);

  return (
    <div className="space-y-4">
      <section className="surface-card p-5">
        <h2 className="font-display text-lg">
          {editingId ? "Editar pedido" : "Novo pedido da loja"}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="order-client">Cliente</Label>
            <Input
              id="order-client"
              value={form.client_name}
              onChange={(e) => set("client_name", e.target.value)}
              placeholder="Ex: Maria Silva"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="order-phone">WhatsApp</Label>
            <Input
              id="order-phone"
              inputMode="numeric"
              value={form.client_phone}
              onChange={(e) => set("client_phone", e.target.value)}
              placeholder="(35) 99999-9999"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="order-item">Produto / item do catálogo</Label>
            <Input
              id="order-item"
              value={form.item_name}
              onChange={(e) => set("item_name", e.target.value)}
              placeholder="Ex: Esmalte gel rosa / Revista Primavera"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="order-amount">Valor a receber (R$)</Label>
            <Input
              id="order-amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="Ex: 89,90"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="order-payment">Forma de pagamento</Label>
            <select
              id="order-payment"
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              value={form.payment_method}
              onChange={(e) => set("payment_method", e.target.value)}
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
              value={form.installments}
              onChange={(e) => set("installments", e.target.value)}
            >
              <option value="1">À vista</option>
              {[2, 3, 4, 5, 6, 10, 12].map((n) => (
                <option key={n} value={String(n)}>
                  {n}x parcelas
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="order-delivery">Data prevista de entrega</Label>
            <Input
              id="order-delivery"
              type="date"
              value={form.delivery_date}
              onChange={(e) => set("delivery_date", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="order-status">Status do pedido</Label>
            <select
              id="order-status"
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
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
              value={form.notes}
              maxLength={280}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Cor, tamanho, detalhes da encomenda..."
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void save()}>
            {editingId ? "Salvar alterações" : "Registrar pedido"}
          </Button>
          {editingId ? (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
              }}
            >
              Cancelar edição
            </Button>
          ) : null}
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        {rows.length} pedido(s) · A receber: {formatPrice(pendingTotal)}
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido registrado ainda.</p>
      ) : (
        rows.map((o) => {
          const link = o.client_phone ? whatsappLinkTo(o.client_phone, "") : null;
          return (
            <article key={o.id} className="surface-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg">{o.client_name}</p>
                  <p className="text-sm">{o.item_name}</p>
                  <p className="text-sm">
                    {formatPrice(Number(o.amount_cents ?? 0))} ·{" "}
                    {o.payment_method
                      ? (PAYMENT_METHOD_LABELS[o.payment_method] ?? o.payment_method)
                      : "Pagamento a definir"}{" "}
                    · {formatInstallments(Number(o.installments ?? 1), Number(o.amount_cents ?? 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.client_phone ? `${formatPhone(o.client_phone)} · ` : ""}Entrega prevista:{" "}
                    {o.delivery_date ? formatDateTime(o.delivery_date) : "a definir"}
                  </p>
                  {o.notes ? <p className="mt-1 text-xs text-muted-foreground">{o.notes}</p> : null}
                </div>
                <Badge variant="secondary">{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  aria-label="Alterar status do pedido"
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                  value={o.status}
                  onChange={(e) => void updateStatus(o.id, e.target.value)}
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {link ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(link, "_blank", "noopener")}
                  >
                    WhatsApp
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(o.id);
                    setForm({
                      client_name: o.client_name,
                      client_phone: o.client_phone ?? "",
                      item_name: o.item_name,
                      amount: (Number(o.amount_cents ?? 0) / 100).toFixed(2).replace(".", ","),
                      payment_method: o.payment_method ?? "pix",
                      installments: String(o.installments ?? 1),
                      delivery_date: o.delivery_date ?? "",
                      status: o.status,
                      notes: o.notes ?? "",
                    });
                  }}
                >
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(o.id)}>
                  Excluir
                </Button>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
