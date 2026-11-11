import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatISODate, formatPrice } from "@/lib/salon";
import type { UnificationPlan } from "@/lib/store-unification";

export function StoreUnificationDialog({ open, onOpenChange, plan, saving, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: UnificationPlan;
  saving: boolean;
  onConfirm: () => void;
}) {
  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-md">
      <AlertDialogHeader>
        <AlertDialogTitle>Confirmar unificação das compras?</AlertDialogTitle>
        <AlertDialogDescription>O saldo de todas as parcelas anteriores em aberto será somado às novas compras e redistribuído neste parcelamento. As parcelas transferidas não serão cobradas novamente. Pagamentos e históricos serão preservados.</AlertDialogDescription>
      </AlertDialogHeader>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt>Saldo anterior ({plan.sources.length} parcelas)</dt><dd>{formatPrice(plan.previousCents)}</dd></div>
        <div className="flex justify-between gap-3"><dt>Novas compras</dt><dd>{formatPrice(plan.newCents)}</dd></div>
        <div className="flex justify-between gap-3 border-t pt-2 font-semibold"><dt>Total a receber</dt><dd>{formatPrice(plan.totalCents)}</dd></div>
      </dl>
      <ul className="divide-y rounded-md border px-3 text-sm">
        {plan.parcels.map((p) => <li key={p.number} className="flex flex-wrap justify-between gap-2 py-2">
          <span>Parcela {p.number} · {p.dueDate ? formatISODate(p.dueDate) : "Sem vencimento"}</span><strong>{formatPrice(p.amountCents)}</strong>
        </li>)}
      </ul>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={saving}>Voltar</AlertDialogCancel>
        <Button disabled={saving} onClick={onConfirm}>{saving ? "Salvando..." : "Confirmar e registrar"}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}