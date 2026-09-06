import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { StoreOrderCard } from "@/components/app/store-order-card";
import { StoreOrderForm } from "@/components/app/store-order-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppSettings } from "@/hooks/useSettings";
import { formatPrice } from "@/lib/salon";
import { fetchStoreOrders, pendingInstallments } from "@/lib/store";

export { fetchStoreOrders };

/** Normaliza para busca sem acento e sem diferenciar maiúsculas. */
function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function StoreOrdersTab() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const settings = useAppSettings();
  const orders = useQuery({ queryKey: ["admin-store-orders"], queryFn: fetchStoreOrders });

  const rows = orders.data ?? [];
  const editing = rows.find((o) => o.id === editingId) ?? null;

  const filtered = useMemo(() => {
    const term = norm(search);
    if (!term) return rows;
    return rows.filter((o) =>
      norm(`${o.client_name} ${o.nickname ?? ""}`).includes(term),
    );
  }, [rows, search]);

  const receivable = filtered.reduce(
    (sum, o) =>
      sum + pendingInstallments(o.installments_list).reduce((s, p) => s + p.amount_cents, 0),
    0,
  );

  return (
    <div className="space-y-4">
      <StoreOrderForm editing={editing} orders={rows} onDone={() => setEditingId(null)} />

      <div className="relative">
        <Search
          size={16}
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <Input
          aria-label="Pesquisar pedido por nome ou apelido do cliente"
          placeholder="Pesquisar cliente por nome ou apelido"
          className="pr-10 pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Limpar pesquisa"
            className="absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2"
            onClick={() => setSearch("")}
          >
            <X size={16} />
          </Button>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} pedido(s) · A receber: {formatPrice(receivable)}
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search ? "Nenhum pedido encontrado para esta pesquisa." : "Nenhum pedido registrado ainda."}
        </p>
      ) : (
        filtered.map((order) => (
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
