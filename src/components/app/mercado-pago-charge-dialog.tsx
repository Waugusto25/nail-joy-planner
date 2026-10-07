import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { checkMercadoPagoPaymentFn, createMercadoPagoChargeFn } from "@/lib/mercado-pago.functions";
import { formatISODate, formatPrice } from "@/lib/salon";
import { BOLETO_DAYS_TO_EXPIRE, BOLETO_FEE_NOTICE, boletoExpiryISO, chargeFeeCents } from "@/lib/mercado-pago-fees";
import type { StoreOrderInstallment } from "@/lib/store";
import { cn } from "@/lib/utils";

type Method = "pix" | "boleto";
const BOLETO_FIELDS = [
  ["cpf", "CPF da cliente"],
  ["zipCode", "CEP"],
  ["street", "Rua"],
  ["streetNumber", "Número"],
  ["neighborhood", "Bairro"],
  ["city", "Cidade"],
  ["state", "UF"],
] as const;
type BoletoKey = (typeof BOLETO_FIELDS)[number][0];

export function MercadoPagoChargeDialog({
  parcel,
  onOpenChange,
}: {
  parcel: StoreOrderInstallment | null;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const createCharge = useServerFn(createMercadoPagoChargeFn);
  const checkPayment = useServerFn(checkMercadoPagoPaymentFn);
  const [method, setMethod] = useState<Method>("pix");
  const [email, setEmail] = useState("");
  const [boleto, setBoleto] = useState<Record<BoletoKey, string>>({
    cpf: "", zipCode: "", street: "", streetNumber: "", neighborhood: "", city: "", state: "",
  });
  const [loading, setLoading] = useState(false);
  const openCents = parcel ? Math.max(0, parcel.amount_cents - (parcel.paid_amount_cents ?? 0)) : 0;
  const feeCents = chargeFeeCents(method);

  async function submit() {
    if (!parcel) return;
    setLoading(true);
    try {
      await createCharge({
        data: { installmentId: parcel.id, method, email, ...(method === "boleto" ? boleto : {}) },
      });
      toast.success("Cobrança gerada no Mercado Pago.");
      await queryClient.invalidateQueries({ queryKey: ["admin-store-orders"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a cobrança.");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (!parcel) return;
    setLoading(true);
    try {
      const r = await checkPayment({ data: { installmentId: parcel.id } });
      if (r.result === "paid") toast.success("Pagamento confirmado — baixa registrada.");
      else if (r.result === "already_paid") toast.info("Esta parcela já estava paga.");
      else toast.info(`Ainda não pago (status: ${r.status}).`);
      await queryClient.invalidateQueries({ queryKey: ["admin-store-orders"] });
      if (r.result !== "pending") onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível verificar.");
    } finally {
      setLoading(false);
    }
  }

  const copy = (text: string) =>
    void navigator.clipboard.writeText(text).then(() => toast.success("Copiado."));

  return (
    <Dialog open={parcel !== null} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Cobrança Mercado Pago</DialogTitle>
          <DialogDescription>
            Parcela {parcel?.number} —{" "}
            {parcel ? formatPrice(parcel.amount_cents - (parcel.paid_amount_cents ?? 0)) : ""}
          </DialogDescription>
        </DialogHeader>

        {parcel?.pix_copia_e_cola && (
          <div className="space-y-2 rounded-md border border-border p-3 text-sm">
            <p className="font-medium">Pix já gerado</p>
            {parcel.pix_qr_code_base64 && (
              <img
                src={`data:image/png;base64,${parcel.pix_qr_code_base64}`}
                alt="QR Code Pix"
                className="mx-auto h-40 w-40"
              />
            )}
            <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => copy(parcel.pix_copia_e_cola ?? "")}>
              <Copy size={14} /> Copiar Pix Copia e Cola
            </Button>
          </div>
        )}
        {parcel?.boleto_linha_digitavel && (
          <div className="space-y-2 rounded-md border border-border p-3 text-sm">
            <p className="font-medium">Boleto já gerado</p>
            {parcel.boleto_expires_on && (
              <p className="text-xs">Vence em {formatISODate(parcel.boleto_expires_on)}</p>
            )}
            <p className="break-all text-xs text-muted-foreground">{parcel.boleto_linha_digitavel}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(parcel.boleto_linha_digitavel ?? "")}>
                <Copy size={14} /> Copiar
              </Button>
              {parcel.boleto_pdf_url && (
                <Button size="sm" variant="outline" asChild>
                  <a href={parcel.boleto_pdf_url} target="_blank" rel="noreferrer">Abrir boleto</a>
                </Button>
              )}
            </div>
          </div>
        )}
        {parcel?.mp_payment_id && (
          <Button variant="secondary" onClick={() => void verify()} disabled={loading} className="gap-1">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Verificar pagamento no Mercado Pago
          </Button>
        )}


        <div className="grid grid-cols-2 gap-2">
          {(["pix", "boleto"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={method === m}
              onClick={() => setMethod(m)}
              className={cn(
                "rounded-md border p-3 text-sm font-medium",
                method === m ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              {m === "pix" ? "Pix" : "Boleto"}
            </button>
          ))}
        </div>

        {parcel ? (
          <div className="space-y-1 rounded-md border border-border p-3 text-sm">
            <p className="flex justify-between">
              <span>Valor da fatura</span>
              <span>{formatPrice(openCents)}</span>
            </p>
            <p className="flex justify-between text-muted-foreground">
              <span>{method === "boleto" ? "Taxa de emissão do boleto" : "Taxa Pix"}</span>
              <span>+ {formatPrice(feeCents)}</span>
            </p>
            <p className="flex justify-between font-semibold">
              <span>Total a cobrar</span>
              <span>{formatPrice(openCents + feeCents)}</span>
            </p>
            {method === "boleto" ? (
              <p className="text-xs text-muted-foreground">
                Vencimento do boleto: {formatISODate(boletoExpiryISO())} ({BOLETO_DAYS_TO_EXPIRE} dias a partir de hoje). {BOLETO_FEE_NOTICE}
              </p>
            ) : null}
          </div>
        ) : null}

        <label className="text-xs text-muted-foreground">
          E-mail da cliente (opcional)
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {method === "boleto" && (
          <div className="grid grid-cols-2 gap-2">
            {BOLETO_FIELDS.map(([key, label]) => (
              <label key={key} className={cn("text-xs text-muted-foreground", key === "street" && "col-span-2")}>
                {label}
                <Input
                  value={boleto[key]}
                  onChange={(e) => setBoleto((b) => ({ ...b, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        )}

        <Button onClick={() => void submit()} disabled={loading} className="gap-1">
          {loading && <Loader2 size={16} className="animate-spin" />}
          {parcel?.mp_payment_id ? "Gerar nova cobrança" : "Gerar cobrança"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
