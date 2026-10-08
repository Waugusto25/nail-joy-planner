import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArchiveRestore, ArrowDownAZ, ArrowUpAZ, CalendarClock, Clock, RefreshCw, Search, X } from "lucide-react";

import { StoreOrderCard } from "@/components/app/store-order-card";
import { StoreOrderForm } from "@/components/app/store-order-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppSettings } from "@/hooks/useSettings";
import { formatPrice } from "@/lib/salon";
import {
  fetchStoreOrders,
  nextPendingDue,
  pendingInstallments,
  type StoreOrderWithDetails,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export { fetchStoreOrders };

/** Critério de ordenação; o padrão é vencimento mais próximo primeiro. */
type SortKey = "due" | "name" | "created";
type SortState = { key: SortKey; asc: boolean };
const DEFAULT_SORT: SortState = { key: "due", asc: true };

/** Normaliza para busca sem acento e sem diferenciar maiúsculas. */
function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function compare(a: StoreOrderWithDetails, b: StoreOrderWithDetails, sort: SortState): number {
  const dir = sort.asc ? 1 : -1;
  if (sort.key === "name") return dir * norm(a.client_name).localeCompare(norm(b.client_name));
  if (sort.key === "created")
    return dir * (b.created_at ?? "").localeCompare(a.created_at ?? "");
  // Pedidos sem parcela em aberto vão sempre para o fim.
  const da = nextPendingDue(a);
  const db = nextPendingDue(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return dir * da.localeCompare(db);
}

export function StoreOrdersTab() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [showArchived, setShowArchived] = useState(false);
  const settings = useAppSettings();
  const orders = useQuery({ queryKey: ["admin-store-orders"], queryFn: fetchStoreOrders });

  const rows = orders.data ?? [];
  const editing = rows.find((o) => o.id === editingId) ?? null;
  const archivedCount = rows.filter((o) => o.archived_at).length;

  const filtered = useMemo(() => {
    const term = norm(search);
    return rows
      .filter((o) => Boolean(o.archived_at) === showArchived)
      .filter((o) => !term || norm(`${o.client_name} ${o.nickname ?? ""}`).includes(term))
      .sort((a, b) => compare(a, b, sort));
  }, [rows, search, sort, showArchived]);

  const receivable = filtered.reduce(
    (sum, o) =>
      sum + pendingInstallments(o.installments_list).reduce((s, p) => s + p.amount_cents, 0),
    0,
  );

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, asc: !prev.asc } : { key, asc: true }));
  }

  async function refreshAll() {
    setSearch("");
    setSort(DEFAULT_SORT);
    setShowArchived(false);
    setEditingId(null);
    await queryClient.invalidateQueries();
  }

  const sortBtn = (key: SortKey, label: string, icon: React.ReactNode) => (
    <Button
      size="sm"
      variant={sort.key === key ? "default" : "outline"}
      className="gap-1"
      aria-pressed={sort.key === key}
      onClick={() => toggleSort(key)}
    >
      {icon}
      {label}
    </Button>
  );

  return (
    <div className="space-y-4">
      <StoreOrderForm editing={editing} orders={rows} onDone={() => setEditingId(null)} />

      <div className="surface-card flex flex-wrap items-center gap-2 p-3">
        {sortBtn(
          "name",
          sort.key === "name" && !sort.asc ? "Z/A" : "A/Z",
          sort.key === "name" && !sort.asc ? <ArrowUpAZ size={16} /> : <ArrowDownAZ size={16} />,
        )}
        {sortBtn(
          "created",
          sort.key === "created" && !sort.asc ? "Mais antigo" : "Mais novo",
          <Clock size={16} />,
        )}
        {sortBtn(
          "due",
          sort.key === "due" && !sort.asc ? "Vencimento distante" : "Vencimento próximo",
          <CalendarClock size={16} />,
        )}
        <Button
          size="sm"
          variant={showArchived ? "default" : "outline"}
          className="gap-1"
          aria-pressed={showArchived}
          onClick={() => setShowArchived((v) => !v)}
        >
          <ArchiveRestore size={16} />
          {showArchived ? "Voltar aos ativos" : `Arquivados (${archivedCount})`}
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Atualizar a página e limpar filtros"
          title="Atualizar a página e limpar filtros"
          onClick={() => void refreshAll()}
        >
          <RefreshCw size={16} className={cn(orders.isFetching && "animate-spin")} />
        </Button>
      </div>

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
        {showArchived ? "Arquivados: " : ""}
        {filtered.length} pedido(s) · A receber: {formatPrice(receivable)}
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search
            ? "Nenhum pedido encontrado para esta pesquisa."
            : showArchived
              ? "Nenhum pedido arquivado."
              : "Nenhum pedido registrado ainda."}
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
