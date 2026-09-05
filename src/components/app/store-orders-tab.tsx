import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { StoreOrderCard, type StoreOrderWithDetails } from "@/components/app/store-order-card";
import { StoreOrderForm } from "@/components/app/store-order-form";
import { useAppSettings } from "@/hooks/useSettings";
import { supabase } from "@/lib/supabase-client";
import { formatPrice } from "@/lib/salon";

export async function fetchStoreOrders(): Promise<StoreOrderWithDetails[]> {
  const { data, error } = await supabase
    .from("store_orders")
    .select(
      "id, created_at, store_client_id, client_name, client_phone, item_name, amount_cents, payment_method, installments, delivery_date, status, notes, store_clients(nickname), store_order_items(id, order_id, name, unit_price_cents, sort_order), store_order_installments(id, order_id, number, amount_cents, due_date, paid_at)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const joined = (row as { store_clients: unknown }).store_clients;
    const client = Array.isArray(joined) ? joined[0] : joined;
    return {
      id: row.id,
      created_at: (row as { created_at?: string | null }).created_at ?? null,
      store_client_id: row.store_client_id,
      client_name: row.client_name,
      client_phone: row.client_phone ?? "",
      nickname: (client as { nickname?: string | null } | null)?.nickname ?? null,
      item_name: row.item_name,
      amount_cents: Number(row.amount_cents ?? 0),
      payment_method: row.payment_method,
      installments: Number(row.installments ?? 1),
      delivery_date: row.delivery_date,
      status: row.status,
      notes: row.notes,
      items: [...(row.store_order_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      installments_list: [...(row.store_order_installments ?? [])].sort(
        (a, b) => a.number - b.number,
      ),
    };
  });
}

export function StoreOrdersTab() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const settings = useAppSettings();
  const orders = useQuery({ queryKey: ["admin-store-orders"], queryFn: fetchStoreOrders });

  const rows = orders.data ?? [];
  const editing = rows.find((o) => o.id === editingId) ?? null;
  const receivable = rows.reduce(
    (sum, o) =>
      sum + o.installments_list.filter((p) => !p.paid_at).reduce((s, p) => s + p.amount_cents, 0),
    0,
  );

  return (
    <div className="space-y-4">
      <StoreOrderForm editing={editing} onDone={() => setEditingId(null)} />

      <p className="text-sm text-muted-foreground">
        {rows.length} pedido(s) · A receber: {formatPrice(receivable)}
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido registrado ainda.</p>
      ) : (
        rows.map((order) => (
          <StoreOrderCard
            key={order.id}
            order={order}
            pixKey={settings.data?.pix_key ?? ""}
            onEdit={() => setEditingId(order.id)}
          />
        ))
      )}
    </div>
  );
}
