import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
import { formatPrice } from "@/lib/salon";
import { supabase } from "@/lib/supabase-client";
import {
  settleInstallment,
  todayISO,
  type StoreOrderInstallment,
  type StoreOrderWithDetails,
} from "@/lib/store";

/** Converte "150,00" ou "150.00" em centavos. */
function toCents(value: string): number {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function toInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function StoreInstallmentPaymentDialog({
  order,
  parcel,
  open,
  onOpenChange,
}: {
  order: StoreOrderWithDetails;
  parcel: StoreOrderInstallment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [paid, setPaid] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && parcel) {
      // Pendente sugere sempre o valor exato da fatura, nunca um pagamento antigo.
      setPaid(toInput(parcel.paid_at && parcel.paid_amount_cents ? parcel.paid_amount_cents : parcel.amount_cents));
      setDate(parcel.paid_at ? parcel.paid_at.slice(0, 10) : todayISO());
    }
  }, [open, parcel]);

  const paidCents = toCents(paid);
  const preview = useMemo(
    () => (parcel ? settleInstallment(order, parcel, paidCents, date || todayISO()) : null),
    [order, parcel, paidCents, date],
  );

  async function save() {
    if (!parcel || !preview) return;
    if (paidCents <= 0) {
      toast.error("Informe o valor efetivamente pago.");
      return;
    }
    setSaving(true);
    try {
      const { error: targetError } = await supabase
        .from("store_order_installments")
        .update({
          paid_at: preview.target.paid_at,
          paid_amount_cents: preview.target.paid_amount_cents,
        })
        .eq("id", preview.target.id);
      if (targetError) throw new Error(targetError.message);

      if (preview.revertUpdate) {
        const { error } = await supabase
          .from("store_order_installments")
          .update({
            amount_cents: preview.revertUpdate.amount_cents,
            credit_applied_cents: preview.revertUpdate.credit_applied_cents,
            carried_in_cents: preview.revertUpdate.carried_in_cents,
          })
          .eq("id", preview.revertUpdate.id);
        if (error) throw new Error(error.message);
      }

      if (preview.nextUpdate) {
        const { error } = await supabase
          .from("store_order_installments")
          .update({
            amount_cents: preview.nextUpdate.amount_cents,
            credit_applied_cents: preview.nextUpdate.credit_applied_cents,
            carried_in_cents: preview.nextUpdate.carried_in_cents,
          })
          .eq("id", preview.nextUpdate.id);
        if (error) throw new Error(error.message);
      }

      if (preview.insert) {
        const { error } = await supabase.from("store_order_installments").insert({
          order_id: order.id,
          number: preview.insert.number,
          amount_cents: preview.insert.amount_cents,
          due_date: preview.insert.due_date,
          carried_in_cents: preview.insert.carried_in_cents,
        });
        if (error) throw new Error(error.message);

        const { error: orderError } = await supabase
          .from("store_orders")
          .update({ installments: preview.totalInstallments })
          .eq("id", order.id);
        if (orderError) throw new Error(orderError.message);
      }

      toast.success("Pagamento registrado.");
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-store-orders"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o acerto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento da parcela</DialogTitle>
          <DialogDescription>
            Aceita valor exato, valor maior (gera crédito) ou valor parcial (o restante vai para o
            próximo mês).
          </DialogDescription>
        </DialogHeader>

        {parcel ? (
          <div className="space-y-3">
            <p className="text-sm">
              Valor da parcela (a cobrar):{" "}
              <strong className="font-semibold">{formatPrice(parcel.amount_cents)}</strong>
            </p>

            <div className="space-y-1">
              <Label htmlFor="paid-amount">Valor efetivamente pago</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="paid-amount"
                  inputMode="decimal"
                  value={paid}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setPaid(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPaid(toInput(parcel.amount_cents))}
                >
                  Valor exato
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="paid-date">Data do pagamento</Label>
              <Input
                id="paid-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {preview && paidCents > 0 ? (
              <div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">
                {preview.creditCents > 0 ? (
                  <p>
                    Crédito de {formatPrice(preview.creditCents)}
                    {preview.nextUpdate
                      ? ` abatido da próxima parcela, que passa a ${formatPrice(preview.nextUpdate.amount_cents)}.`
                      : " sem parcela seguinte para abater — fica como crédito a favor do cliente."}
                  </p>
                ) : null}
                {preview.shortfallCents > 0 ? (
                  <p>
                    Faltam {formatPrice(preview.shortfallCents)}
                    {preview.nextUpdate
                      ? `, somados à próxima parcela, que passa a ${formatPrice(preview.nextUpdate.amount_cents)}.`
                      : `, que criam uma nova parcela de ${formatPrice(preview.insert?.amount_cents ?? 0)}.`}
                  </p>
                ) : null}
                {preview.creditCents === 0 && preview.shortfallCents === 0 ? (
                  <p>Pagamento exato: a parcela fica paga e as próximas não mudam.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || paidCents <= 0}>
            {saving ? "Salvando..." : "Registrar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
