import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase-client";
import { clearFinanceHistoryFn } from "@/lib/finance.functions";
import { PAYMENT_METHODS, formatPrice } from "@/lib/salon";

function isoDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
  return { from: isoDay(start), to: isoDay(end) };
}

function monthLabel(offset: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function FinanceTab() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"mes" | "personalizado">("mes");
  const [monthOffset, setMonthOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState(monthRange(0).from);
  const [customTo, setCustomTo] = useState(monthRange(0).to);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function clearHistory() {
    setClearing(true);
    try {
      const result = await clearFinanceHistoryFn();
      await queryClient.invalidateQueries();
      toast.success(
        `Faturamento limpo: ${result.appointments} atendimento(s) e ${result.orders} pedido(s) apagados.`,
      );
      setConfirmOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível limpar agora.");
    } finally {
      setClearing(false);
    }
  }

  const range = useMemo(
    () => (mode === "mes" ? monthRange(monthOffset) : { from: customFrom, to: customTo }),
    [mode, monthOffset, customFrom, customTo],
  );

  const finance = useQuery({
    queryKey: ["admin-finance", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, client_id, price_cents, payment_method, day, services(name)")
        .eq("status", "concluido")
        .gte("day", range.from)
        .lte("day", range.to);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = finance.data ?? [];
  const total = rows.reduce((sum, r) => sum + Number(r.price_cents ?? 0), 0);
  const clients = new Set(rows.map((r) => String(r.client_id))).size;
  const ticket = rows.length > 0 ? Math.round(total / rows.length) : 0;
  const ticketClient = clients > 0 ? Math.round(total / clients) : 0;

  const byService = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const r of rows) {
      const joined = (r as { services: unknown }).services;
      const service = Array.isArray(joined) ? joined[0] : joined;
      const name = (service as { name?: string } | null)?.name ?? "Avulso";
      const current = map.get(name) ?? { name, total: 0, count: 0 };
      current.total += Number(r.price_cents ?? 0);
      current.count += 1;
      map.set(name, current);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows]);

  const byPayment = useMemo(
    () =>
      PAYMENT_METHODS.map((m) => ({
        label: m.label,
        total: rows
          .filter((r) => r.payment_method === m.value)
          .reduce((sum, r) => sum + Number(r.price_cents ?? 0), 0),
      })),
    [rows],
  );
  const semRegistro = rows
    .filter((r) => !r.payment_method)
    .reduce((sum, r) => sum + Number(r.price_cents ?? 0), 0);

  const chartData = byService.map((s) => ({ name: s.name, valor: s.total / 100 }));

  return (
    <div className="space-y-5">
      <section className="surface-card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((offset) => (
            <Button
              key={offset}
              size="sm"
              variant={mode === "mes" && monthOffset === offset ? "default" : "outline"}
              onClick={() => {
                setMode("mes");
                setMonthOffset(offset);
              }}
              className="capitalize"
            >
              {offset === 0 ? "Mês atual" : monthLabel(offset)}
            </Button>
          ))}
          <Button
            size="sm"
            variant={mode === "personalizado" ? "default" : "outline"}
            onClick={() => setMode("personalizado")}
          >
            Personalizado
          </Button>
        </div>
        {mode === "personalizado" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="fin-de">De</Label>
              <Input
                id="fin-de"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fin-ate">Até</Label>
              <Input
                id="fin-ate"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Ganhos no período</p>
          <p className="font-display text-2xl">{formatPrice(total)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Atendimentos concluídos</p>
          <p className="font-display text-2xl">{rows.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Ticket médio por atendimento</p>
          <p className="font-display text-2xl">{formatPrice(ticket)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Média por cliente ({clients})</p>
          <p className="font-display text-2xl">{formatPrice(ticketClient)}</p>
        </article>
      </section>

      <section className="surface-card p-4">
        <h2 className="font-display text-lg">Receita por procedimento</h2>
        {chartData.length === 0 ? (
          <p className="pt-2 text-sm text-muted-foreground">
            Nenhum atendimento concluído neste período.
          </p>
        ) : (
          <div className="h-64 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => formatPrice(Math.round(value * 100))}
                  labelStyle={{ color: "var(--foreground)" }}
                />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill="var(--primary)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="surface-card p-4">
        <h2 className="font-display text-lg">Serviços mais lucrativos</h2>
        <ul className="mt-3 space-y-2">
          {byService.map((s, index) => (
            <li key={s.name} className="flex items-center justify-between text-sm">
              <span>
                {index + 1}. {s.name}{" "}
                <span className="text-muted-foreground">({s.count}x)</span>
              </span>
              <span className="font-semibold">{formatPrice(s.total)}</span>
            </li>
          ))}
          {byService.length === 0 ? (
            <li className="text-sm text-muted-foreground">Sem dados no período.</li>
          ) : null}
        </ul>
      </section>

      <section className="surface-card p-4">
        <h2 className="font-display text-lg">Fechamento de caixa</h2>
        <ul className="mt-3 space-y-2">
          {byPayment.map((p) => (
            <li key={p.label} className="flex items-center justify-between text-sm">
              <span>{p.label}</span>
              <span className="font-semibold">{formatPrice(p.total)}</span>
            </li>
          ))}
          {semRegistro > 0 ? (
            <li className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Sem forma de pagamento registrada</span>
              <span>{formatPrice(semRegistro)}</span>
            </li>
          ) : null}
        </ul>
      </section>

      <div className="flex justify-end pb-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 size={16} /> Limpar Histórico de Faturamento
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Limpar Faturamento</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza de que deseja apagar todo o seu histórico de faturamento mensal e
              registros de receitas? Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={clearing}
              onClick={(event) => {
                event.preventDefault();
                void clearHistory();
              }}
            >
              {clearing ? "Apagando..." : "Sim, apagar tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
