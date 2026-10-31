import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatISODate, formatPrice } from "@/lib/salon";
import { advancedCents, remainingCents, saoPauloToday, validateAdvance } from "@/lib/store-advance";
import { recordStoreAdvanceFn } from "@/lib/store-advance.functions";
import type { StoreOrderInstallment } from "@/lib/store";

export function StoreInstallmentAdvanceDialog({ parcel, onClose }: {
  parcel: StoreOrderInstallment;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const record = useServerFn(recordStoreAdvanceFn);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(saoPauloToday());
  const [requestId] = useState(() => crypto.randomUUID());
  const cents = Math.round(Number(amount.replace(/\./g, "").replace(",", ".")) * 100);
  const balance = remainingCents(parcel);
  const valid = validateAdvance(parcel, cents) && Boolean(date) && date <= saoPauloToday();
  const save = useMutation({
    mutationFn: () => record({ data: { installmentId: parcel.id, amountCents: cents, paidOn: date, requestId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-store-orders"] });
      toast.success("Adiantamento registrado.");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adiantamento — parcela {parcel.number}</DialogTitle>
          <DialogDescription>Vencimento: {formatISODate(parcel.due_date)}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt>Valor da parcela</dt><dd className="text-right font-medium">{formatPrice(parcel.amount_cents)}</dd>
          <dt>Já adiantado</dt><dd className="text-right">{formatPrice(advancedCents(parcel))}</dd>
          <dt>Saldo deste mês</dt><dd className="text-right font-semibold">{formatPrice(balance)}</dd>
        </dl>
        <div className="space-y-2">
          <Label htmlFor="advance-amount">Valor do adiantamento</Label>
          <Input id="advance-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus disabled={save.isPending} />
          {Number.isFinite(cents) && cents > balance && <p className="text-sm text-destructive">O valor não pode exceder {formatPrice(balance)}.</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="advance-date">Data do recebimento</Label>
          <Input id="advance-date" type="date" max={saoPauloToday()} value={date} onChange={(e) => setDate(e.target.value)} disabled={save.isPending} />
        </div>
        {valid && <p className="text-sm font-medium">Restante deste mês: {formatPrice(balance - cents)}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>{save.isPending ? "Salvando..." : "Registrar adiantamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}