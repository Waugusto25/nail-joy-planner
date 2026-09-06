import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchStoreOrders } from "@/components/app/store-orders-tab";
import { ORDER_STATUS_LABELS, formatISODate, formatPrice } from "@/lib/salon";

/** Primeiro e último dia do mês atual em "YYYY-MM-DD", sempre no fuso local. */
function monthBounds(): { from: string; to: string } {
  const now = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export function StoreDashboardTab() {
  const orders = useQuery({ queryKey: ["admin-store-orders"], queryFn: fetchStoreOrders });
  const rows = orders.data ?? [];
  const current = monthBounds();
  const [range, setRange] = useState(current);

  const isCurrentMonth = range.from === current.from && range.to === current.to;

  const parcels = useMemo(
    () =>
      rows.flatMap((o) =>
        o.installments_list
          // Parcelas unificadas em um novo pedido não entram no caixa duas vezes.
          .filter((p) => !p.merged_into_order_id)
          .map((p) => ({
            ...p,
            clientName: o.client_name,
            nickname: o.nickname,
            status: o.status,
          })),
      ),
    [rows],
  );

  // Comparação direta de strings "YYYY-MM-DD": sem Date, sem deslocamento de fuso.
  const inRange = (day: string | null) => Boolean(day && day >= range.from && day <= range.to);

  const toReceive = parcels
    .filter((p) => !p.paid_at && inRange(p.due_date))
    .reduce((s, p) => s + p.amount_cents, 0);
  const received = parcels
    .filter((p) => p.paid_at && inRange(p.paid_at.slice(0, 10)))
    .reduce((s, p) => s + (p.paid_amount_cents || p.amount_cents), 0);
  const periodTotal = toReceive + received;

  const upcoming = parcels
    .filter((p) => !p.paid_at && inRange(p.due_date))
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const chartData = [
    { name: "Recebido", valor: received / 100 },
    { name: "A receber", valor: toReceive / 100 },
  ];

  return (
    <div className="space-y-5">
      <section className="surface-card flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1">
          <Label htmlFor="dash-from">Data inicial</Label>
          <Input
            id="dash-from"
            type="date"
            className="h-9"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dash-to">Data final</Label>
          <Input
            id="dash-to"
            type="date"
            className="h-9"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
        <Button
          size="sm"
          variant={isCurrentMonth ? "default" : "secondary"}
          onClick={() => setRange(monthBounds())}
        >
          Mês atual
        </Button>
        <p className="text-xs text-muted-foreground">
          {isCurrentMonth ? "Período: mês atual" : "Período personalizado"} ·{" "}
          {formatISODate(range.from)} a {formatISODate(range.to)}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Total a receber no período</p>
          <p className="font-display text-2xl">{formatPrice(toReceive)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Total já recebido no período</p>
          <p className="font-display text-2xl">{formatPrice(received)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Valor total do período</p>
          <p className="font-display text-2xl">{formatPrice(periodTotal)}</p>
        </article>
      </section>

      <section className="surface-card p-4">
        <h2 className="font-display text-lg">Recebido x a receber no período</h2>
        <div className="h-56 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => formatPrice(Math.round(value * 100))} />
              <Bar dataKey="valor" radius={[6, 6, 0, 0]} fill="var(--primary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="surface-card p-4">
        <h2 className="font-display text-lg">Próximos vencimentos</h2>
        <ul className="mt-3 space-y-2">
          {upcoming.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <strong className="font-semibold">{p.clientName}</strong>
                {p.nickname?.trim() ? (
                  <span className="block text-xs text-muted-foreground">
                    ({p.nickname.trim()})
                  </span>
                ) : null}
                <span className="block text-xs text-muted-foreground">
                  Parcela {p.number} · {p.due_date ? formatISODate(p.due_date) : "sem data"}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge variant="secondary">{ORDER_STATUS_LABELS[p.status] ?? p.status}</Badge>
                <strong>{formatPrice(p.amount_cents)}</strong>
              </span>
            </li>
          ))}
          {upcoming.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              Nenhuma parcela pendente com vencimento neste período.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
