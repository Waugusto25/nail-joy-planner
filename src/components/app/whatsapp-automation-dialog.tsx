import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { saveWhatsappSettingsFn, testWhatsappFn, whatsappSettingsFn } from "@/lib/whatsapp.functions";
import { whatsappConfigSchema } from "@/lib/whatsapp-rules";

export function WhatsappAutomationDialog() {
  const [open, setOpen] = useState(false);
  const read = useServerFn(whatsappSettingsFn);
  const query = useQuery({ queryKey: ["whatsapp-automation"], queryFn: () => read(), enabled: open });
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><MessageCircle className="size-4" /> WhatsApp automático</Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>WhatsApp automático</DialogTitle></DialogHeader>
      {query.isPending ? <p>Carregando...</p> : query.isError ? <><p role="alert">Não foi possível carregar.</p><Button onClick={() => void query.refetch()}>Tentar novamente</Button></> : <WhatsappForm initial={query.data} />}
    </DialogContent>
  </Dialog>;
}

function WhatsappForm({ initial }: { initial: Awaited<ReturnType<typeof whatsappSettingsFn>> }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState(initial.settings?.api_url || "");
  const [instance, setInstance] = useState(initial.settings?.instance_name || "JannahNails");
  const [enabled, setEnabled] = useState(initial.settings?.enabled || false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveWhatsappSettingsFn), test = useServerFn(testWhatsappFn);
  async function run(testing: boolean) {
    setBusy(true);
    try {
      const data = { api_url: url, instance_name: instance, enabled };
      const validation = whatsappConfigSchema.safeParse(data);
      if (!validation.success) {
        toast.error(validation.error.issues[0]?.message || "Confira o endereço e a instância.");
        return;
      }
      if (testing) await test({ data: { ...data, phone } }); else await save({ data });
      toast.success(testing ? "Mensagem de teste enviada." : "Configuração salva.");
      await qc.invalidateQueries({ queryKey: ["whatsapp-automation"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível concluir."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Chave da API: {initial.keyConfigured ? "configurada" : "não configurada"}</p>
    <div className="space-y-1"><Label htmlFor="wa-url">Endereço da Evolution (HTTPS)</Label><Input id="wa-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.seudominio.com" /></div>
    <div className="space-y-1"><Label htmlFor="wa-instance">Instância</Label><Input id="wa-instance" value={instance} onChange={(e) => setInstance(e.target.value)} /></div>
    <div className="flex items-center justify-between"><Label htmlFor="wa-enabled">Envio automático</Label><Switch id="wa-enabled" checked={enabled} onCheckedChange={setEnabled} /></div>
    <Button disabled={busy} onClick={() => void run(false)}><Save className="size-4" />{busy ? "Aguarde..." : "Salvar"}</Button>
    <div className="space-y-2 border-t pt-4"><Label htmlFor="wa-test">Telefone para teste</Label><Input id="wa-test" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /><Button variant="outline" disabled={busy || !phone} onClick={() => void run(true)}><Send className="size-4" />Enviar teste</Button></div>
    <h3 className="text-base">Últimos envios</h3>
    {initial.logs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum envio registrado.</p> : initial.logs.map((l) => <div key={l.id} className="border-b py-2 text-sm"><span>{l.kind} · {l.status}</span>{l.last_error && <p className="text-destructive">{l.last_error}</p>}</div>)}
  </div>;
}