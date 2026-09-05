import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatISODate, formatPrice } from "@/lib/salon";
import { supabase } from "@/lib/supabase-client";
import { appendItemInstallments, type StoreOrderWithDetails } from "@/lib/store";

type ItemRow = { key: string; name: string; price: string };

const itemSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do produto."),
  unit_price_cents: z.number().int().min(1, "Informe um valor maior que zero."),
});

function newItem(): ItemRow {
  return { key: crypto.randomUUID(), name: "", price: "" };
}

function toCents(value: string): number {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function StoreOrderAddItemsDialog({
  order,
  open,
  onOpenChange,
}: {
  order: StoreOrderWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ItemRow[]>([newItem()]);
  const [count, setCount] = useState("1");
  const [saving, setSaving] = useState(false);

  const added = useMemo(() => rows.reduce((sum, r) => sum + toCents(r.price), 0), [rows]);
  const parts = Math.max(1, Number(count) || 1);
  const plan = appendItemInstallments(order, added, parts);

  async function save() {
    const parsed = rows
      .filter((r) => r.name.trim() || r.price.trim())
      .map((r) => itemSchema.safeParse({ name: r.name, unit_price_cents: toCents(r.price) }));
    if (parsed.length === 0 || parsed.some((p) => !p.success)) {
      toast.error("Preencha nome e valor de cada produto acrescentado.");
      return;
    }
    const items = parsed.flatMap((p) => (p.success ? [p.data] : []));
    const addedCents = items.reduce((sum, i) => sum + i.unit_price_cents, 0);
    const change = appendItemInstallments(order, addedCents, parts);

    setSaving(true);
    try {
      const nextSort = order.items.reduce((max, i) => Math.max(max, i.sort_order), -1) + 1;
      const { error: itemsError } = await supabase.from("store_order_items").insert(
        items.map((item, index) => ({
          order_id: order.id,
          name: item.name,
          unit_price_cents: item.unit_price_cents,
          sort_order: nextSort + index,
        })),
      );
      if (itemsError) throw new Error(itemsError.message);

      for (const parcel of change.update) {
        const { error } = await supabase
          .from("store_order_installments")
          .update({
            amount_cents: parcel.amount_cents,
            added_extra_cents: parcel.added_extra_cents,
          })
          .eq("id", parcel.id);
        if (error) throw new Error(error.message);
      }
      if (change.insert.length > 0) {
        const { error } = await supabase.from("store_order_installments").insert(
          change.insert.map((p) => ({
            order_id: order.id,
            number: p.number,
            amount_cents: p.amount_cents,
            due_date: p.due_date,
            added_extra_cents: p.added_extra_cents,
          })),
        );
        if (error) throw new Error(error.message);
      }

      const names = [...order.items.map((i) => i.name), ...items.map((i) => i.name)].join(", ");
      const { error: orderError } = await supabase
        .from("store_orders")
        .update({
          amount_cents: order.amount_cents + addedCents,
          item_name: names,
          installments: change.totalInstallments,
        })
        .eq("id", order.id);
      if (orderError) throw new Error(orderError.message);

      toast.success("Produto acrescentado ao pedido.");
      setRows([newItem()]);
      setCount("1");
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-store-orders"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar os itens.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar produto ao pedido</DialogTitle>
          <DialogDescription>
            Os itens entram neste mesmo pedido. Parcelas já pagas não são alteradas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Novos itens</Label>
          {rows.map((row, index) => (
            <div key={row.key} className="flex items-end gap-2">
              <Input
                aria-label={`Nome do novo item ${index + 1}`}
                value={row.name}
                placeholder="Ex: Base fortalecedora"
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((p) => (p.key === row.key ? { ...p, name: e.target.value } : p)),
                  )
                }
              />
              <Input
                aria-label={`Valor do novo item ${index + 1}`}
                className="w-32"
                inputMode="decimal"
                value={row.price}
                placeholder="59,90"
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((p) => (p.key === row.key ? { ...p, price: e.target.value } : p)),
                  )
                }
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remover novo item ${index + 1}`}
                disabled={rows.length === 1}
                onClick={() => setRows((prev) => prev.filter((p) => p.key !== row.key))}
              >
                <X size={16} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1"
            onClick={() => setRows((prev) => [...prev, newItem()])}
          >
            <Plus size={16} /> Adicionar item
          </Button>
        </div>

        <div className="space-y-1">
          <Label htmlFor="add-items-count">Parcelar o novo item em quantas vezes</Label>
          <Input
            id="add-items-count"
            className="w-24"
            inputMode="numeric"
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/\D/g, "") || "1")}
          />
          <p className="text-xs text-muted-foreground">
            Cada parcela do item novo é somada à parcela pendente do mês correspondente; o que
            sobrar cria meses novos.
          </p>
        </div>

        <div className="rounded-md border border-border/60 p-3 text-sm">
          <p>Acréscimo: {formatPrice(added)}</p>
          <p className="font-semibold">
            Novo valor total do pedido: {formatPrice(order.amount_cents + added)}
          </p>
          <p className="text-muted-foreground">
            Saldo devedor a cobrar: {formatPrice(plan.pendingBalanceCents)}
          </p>
        </div>

        {added > 0 ? (
          <div className="space-y-1 rounded-md border border-border/60 p-3 text-sm">
            <p className="font-medium">Cronograma resultante</p>
            {plan.update.map((p) => (
              <p key={p.id} className="text-muted-foreground">
                Parcela {p.number} · {p.due_date ? formatISODate(p.due_date) : "sem vencimento"} ·{" "}
                {formatPrice(p.amount_cents)}{" "}
                <span className="text-primary">
                  (inclui {formatPrice(p.added_extra_cents)} do item novo)
                </span>
              </p>
            ))}
            {plan.insert.map((p) => (
              <p key={`new-${p.number}`} className="text-muted-foreground">
                Parcela {p.number} (nova) ·{" "}
                {p.due_date ? formatISODate(p.due_date) : "sem vencimento"} ·{" "}
                {formatPrice(p.amount_cents)}
              </p>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || added <= 0}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
