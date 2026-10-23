import { useEffect, useState } from "react";
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
import { todayISO } from "@/lib/store";

type Props = {
  open: boolean;
  clientName: string;
  onCancel: () => void;
  onConfirm: (date: string) => void;
};

/** Confirma o dia real da entrega antes de marcar o pedido como "Entregue". */
export function StoreDeliveryDateDialog({ open, clientName, onCancel, onConfirm }: Props) {
  const [date, setDate] = useState(todayISO());

  // Cada abertura começa em "hoje", que é o caso mais comum.
  useEffect(() => {
    if (open) setDate(todayISO());
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar entrega</DialogTitle>
          <DialogDescription>Em que dia o pedido de {clientName} foi entregue?</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="delivered-on">Data da entrega</Label>
          <Input
            id="delivered-on"
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button disabled={!date} onClick={() => onConfirm(date)}>
            Confirmar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
