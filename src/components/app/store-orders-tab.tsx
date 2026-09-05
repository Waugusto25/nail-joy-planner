import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { StoreOrderCard } from "@/components/app/store-order-card";
import { StoreOrderForm } from "@/components/app/store-order-form";
import { useAppSettings } from "@/hooks/useSettings";
import { formatPrice } from "@/lib/salon";
import { fetchStoreOrders, pendingInstallments } from "@/lib/store";

export { fetchStoreOrders };

export function StoreOrdersTab() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const settings = useAppSettings();
  const orders = useQuery({ queryKey: ["admin-store-orders"], queryFn: fetchStoreOrders });

  const rows = orders.data ?? [];
  const editing = rows.find((o) => o.id === editingId) ?? null;
  const receivable = rows.reduce(
    (sum, o) =>
      sum + pendingInstallments(o.installments_list).reduce((s, p) => s + p.amount_cents, 0),
    0,
  );

  return (
    <div className="space-y-4">
      <StoreOrderForm editing={editing} orders={rows} onDone={() => setEditingId(null)} />

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
