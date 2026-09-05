import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { fetchStoreOrders } from "@/components/app/store-orders-tab";
import { ORDER_STATUS_LABELS, formatISODate, formatPrice } from "@/lib/salon";

function monthBounds() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(first), to: iso(last) };
}

export function StoreDashboardTab() {
  const orders = useQuery({ queryKey: ["admin-store-orders"], queryFn: fetchStoreOrders });
  const rows = orders.data ?? [];
  const { from, to } = monthBounds();

  const parcels = useMemo(
    () =>
      rows.flatMap((o) =>
        o.installments_list.map((p) => ({
          ...p,
          clientName: o.client_name,
          nickname: o.nickname,
          status: o.status,
        })),
      ),
    [rows],
  );

  const inMonth = (day: string | null) => Boolean(day && day >= from && day <= to);

  const toReceive = parcels
    .filter((p) => !p.paid_at && inMonth(p.due_date))
    .reduce((s, p) => s + p.amount_cents, 0);
  const received = parcels
    .filter((p) => p.paid_at && inMonth(p.paid_at.slice(0, 10)))
    .reduce((s, p) => s + p.amount_cents, 0);
  const monthTotal = toReceive + received;

  const upcoming = parcels
    .filter((p) => !p.paid_at && p.due_date)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 10);

  const chartData = [
    { name: "Recebido", valor: received / 100 },
    { name: "A receber", valor: toReceive / 100 },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Total a receber no mês</p>
          <p className="font-display text-2xl">{formatPrice(toReceive)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Total já recebido no mês</p>
          <p className="font-display text-2xl">{formatPrice(received)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Valor total do mês</p>
          <p className="font-display text-2xl">{formatPrice(monthTotal)}</p>
        </article>
      </section>

      <section className="surface-card p-4">
        <h2 className="font-display text-lg">Recebido x a receber no mês</h2>
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
                {p.nickname?.trim() || p.clientName} · parcela {p.number} ·{" "}
                {p.due_date ? formatISODate(p.due_date) : "sem data"}
              </span>
              <span className="flex items-center gap-2">
                <Badge variant="secondary">{ORDER_STATUS_LABELS[p.status] ?? p.status}</Badge>
                <strong>{formatPrice(p.amount_cents)}</strong>
              </span>
            </li>
          ))}
          {upcoming.length === 0 ? (
            <li className="text-sm text-muted-foreground">Nenhuma parcela pendente com data.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
