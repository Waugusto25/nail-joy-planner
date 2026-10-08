import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/salon";
import type { StoreOrderWithDetails } from "@/lib/store";
import {
  computeReport,
  drawGeneralReport,
  splitByMonth,
  type ReportRange,
} from "@/lib/store-general-report";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function presets(): Record<"Este mês" | "Mês anterior" | "Ano atual", ReportRange> {
  const n = new Date();
  return {
    "Este mês": { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)) },
    "Mês anterior": { from: iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: iso(new Date(n.getFullYear(), n.getMonth(), 0)) },
    "Ano atual": { from: `${n.getFullYear()}-01-01`, to: `${n.getFullYear()}-12-31` },
  };
}

export function StoreGeneralReportDialog({ orders }: { orders: StoreOrderWithDetails[] }) {
  const p = presets();
  const [range, setRange] = useState<ReportRange>(p["Este mês"]);
  const [busy, setBusy] = useState(false);
  const totals = useMemo(() => computeReport(orders, range), [orders, range]);
  const valid = Boolean(range.from && range.to && range.from <= range.to);

  async function generate(perMonth: boolean) {
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const parts = perMonth ? splitByMonth(range) : [range];
      for (const part of parts) {
        const doc = new jsPDF();
        drawGeneralReport(doc, computeReport(orders, part), part);
        doc.save(`relatorio-loja-${part.from}_a_${part.to}.pdf`);
      }
      toast.success(`${parts.length} PDF(s) gerado(s).`);
    } catch {
      toast.error("Não foi possível gerar o relatório.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <FileText size={16} /> Relatório
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Relatório geral da Loja</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {Object.entries(p).map(([label, r]) => (
            <Button key={label} size="sm" variant="secondary" onClick={() => setRange(r)}>
              {label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="rep-from">De</Label>
            <Input id="rep-from" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rep-to">Até</Label>
            <Input id="rep-to" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div><dt className="text-muted-foreground">Vendido</dt><dd className="font-semibold">{formatPrice(totals.sold)}</dd></div>
          <div><dt className="text-muted-foreground">Pago</dt><dd className="font-semibold">{formatPrice(totals.paid)}</dd></div>
          <div><dt className="text-muted-foreground">A receber</dt><dd className="font-semibold">{formatPrice(totals.pending)}</dd></div>
        </dl>
        <div className="flex flex-col gap-2">
          <Button disabled={!valid || busy} onClick={() => void generate(false)}>Gerar PDF do período</Button>
          <Button variant="outline" disabled={!valid || busy} onClick={() => void generate(true)}>Gerar um PDF por mês</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
