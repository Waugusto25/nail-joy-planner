import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { StoreOrderWithDetails } from "@/components/app/store-order-card";
import { fetchStoreOrders } from "@/components/app/store-orders-tab";
import { drawStatement, statementFileName } from "@/lib/store-statement";
import { onlyDigits } from "@/lib/salon";

type Props = {
  clientId: string | null;
  clientName: string;
  clientPhone: string;
  size?: "sm" | "default";
};

/** Filtra os pedidos do cliente: por vínculo direto e, no legado, pelo telefone. */
function ordersOfClient(
  all: StoreOrderWithDetails[],
  clientId: string | null,
  phone: string,
): StoreOrderWithDetails[] {
  const digits = onlyDigits(phone);
  return all.filter((order) => {
    if (clientId && order.store_client_id === clientId) return true;
    if (!order.store_client_id && digits && onlyDigits(order.client_phone) === digits) return true;
    return false;
  });
}

export function StoreStatementButton({ clientId, clientName, clientPhone, size = "sm" }: Props) {
  const [loading, setLoading] = useState(false);

  async function exportPdf() {
    setLoading(true);
    try {
      const all = await fetchStoreOrders();
      const orders = ordersOfClient(all, clientId, clientPhone);
      if (orders.length === 0) {
        toast.info("Este cliente ainda não possui pedidos para gerar extrato.");
        return;
      }

      // jsPDF só é carregado no clique, mantendo o painel leve.
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      drawStatement(doc, { clientName, clientPhone, orders });
      doc.save(statementFileName(clientName));
      toast.success("Extrato em PDF gerado.");
    } catch {
      toast.error("Não foi possível gerar o extrato em PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size={size}
      variant="outline"
      className="gap-1"
      disabled={loading}
      onClick={() => void exportPdf()}
    >
      <FileDown size={16} aria-hidden />
      {loading ? "Gerando..." : "Exportar Extrato (PDF)"}
    </Button>
  );
}
