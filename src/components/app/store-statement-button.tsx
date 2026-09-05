import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { StoreOrderWithDetails } from "@/components/app/store-order-card";
import { fetchStoreOrders } from "@/components/app/store-orders-tab";
import { buildStatementHtml, statementFileName } from "@/lib/store-statement";
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

      // O extrato é renderizado dentro de um iframe isolado: os estilos do app usam
      // cores em oklch, que o gerador de imagem do PDF não sabe interpretar.
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.position = "fixed";
      frame.style.left = "-10000px";
      frame.style.top = "0";
      frame.style.width = "820px";
      frame.style.height = "1200px";
      frame.style.border = "0";
      document.body.appendChild(frame);

      try {
        const doc = frame.contentDocument;
        if (!doc) throw new Error("iframe indisponível");
        doc.open();
        doc.write(
          `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#ffffff;color:#1f2430;}</style></head><body>${buildStatementHtml(
            { clientName, clientPhone, orders },
          )}</body></html>`,
        );
        doc.close();
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

        const { default: html2pdf } = await import("html2pdf.js");
        await html2pdf()
          .set({
            margin: [10, 8, 10, 8],
            filename: statementFileName(clientName),
            image: { type: "jpeg", quality: 0.97 },
            html2canvas: { scale: 2, backgroundColor: "#ffffff", useCORS: true },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            // Evita cortar um pedido no meio da página (opção suportada em runtime).
            ...{ pagebreak: { mode: ["css", "avoid-all"] } },
          })
          .from(doc.body)
          .save();
        toast.success("Extrato em PDF gerado.");
      } finally {
        frame.remove();
      }

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
