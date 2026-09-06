import { useEffect, useState } from "react";
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
import { formatISODate, formatPrice } from "@/lib/salon";
import { installmentState, type StoreOrderWithDetails } from "@/lib/store";
import { drawStatement, statementFileName } from "@/lib/store-statement";
import { drawInvoice, invoiceFileName, invoiceableInstallments } from "@/lib/store-invoice";
import { cn } from "@/lib/utils";

type Mode = "total" | "mes";

export function StoreInvoiceExportDialog({
  order,
  pixKey,
  open,
  onOpenChange,
  initialParcelNumber,
}: {
  order: StoreOrderWithDetails;
  pixKey: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  initialParcelNumber?: number | null;
}) {
  const parcels = invoiceableInstallments(order);
  const [mode, setMode] = useState<Mode>(initialParcelNumber ? "mes" : "total");
  const [selected, setSelected] = useState<number | null>(
    initialParcelNumber ?? parcels[0]?.number ?? null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(initialParcelNumber ? "mes" : "total");
    setSelected(initialParcelNumber ?? parcels[0]?.number ?? null);
  }, [open, initialParcelNumber, parcels]);

  async function generate() {
    setLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      if (mode === "total") {
        drawStatement(doc, {
          clientName: order.client_name,
          clientPhone: order.client_phone,
          orders: [order],
        });
        doc.save(statementFileName(order.client_name));
      } else {
        const parcel = parcels.find((p) => p.number === selected);
        if (!parcel) {
          toast.info("Selecione uma parcela para gerar a fatura do mês.");
          return;
        }
        drawInvoice(doc, {
          clientName: order.client_name,
          clientPhone: order.client_phone,
          order,
          parcel,
          pixKey,
        });
        doc.save(invoiceFileName(order.client_name, parcel.number));
      }
      toast.success("PDF gerado.");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar PDF do pedido</DialogTitle>
          <DialogDescription>
            Escolha entre a fatura total do pedido ou a fatura de um mês específico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={mode === "total"}
              onClick={() => setMode("total")}
              className={cn(
                "rounded-md border p-3 text-left text-sm",
                mode === "total" ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <span className="block font-medium">1. Fatura Total do Pedido</span>
              <span className="text-muted-foreground text-xs">
                Documento completo com todas as parcelas, para conferência.
              </span>
            </button>
            <button
              type="button"
              aria-pressed={mode === "mes"}
              onClick={() => setMode("mes")}
              className={cn(
                "rounded-md border p-3 text-left text-sm",
                mode === "mes" ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <span className="block font-medium">2. Fatura do Mês</span>
              <span className="text-muted-foreground text-xs">
                Somente a parcela escolhida, com os produtos daquele mês.
              </span>
            </button>
          </div>

          {mode === "mes" ? (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {parcels.map((p) => {
                const state = installmentState(p);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={selected === p.number}
                      onClick={() => setSelected(p.number)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
                        selected === p.number ? "border-primary bg-primary/5" : "border-border",
                      )}
                    >
                      <span>
                        Parcela {p.number}/{parcels.length} · {formatISODate(p.due_date)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatPrice(p.amount_cents)} ·{" "}
                        {state === "paga" ? "PAGO" : state === "parcial" ? "PARCIAL" : "PENDENTE"}
                      </span>
                    </button>
                  </li>
                );
              })}
              {parcels.length === 0 ? (
                <li className="text-muted-foreground text-sm">Sem parcelas registradas.</li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={loading} onClick={() => void generate()}>
            {loading ? "Gerando..." : "Gerar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
