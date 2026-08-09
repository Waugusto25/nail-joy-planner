import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentProfile } from "@/hooks/useSession";
import { requestEmailChangeFn, updateMyAccountFn } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatPhone } from "@/lib/salon";

/** Configurações da conta da cliente: telefone de acesso e e-mail opcional. */
export function AccountSettingsDialog() {
  const { profile } = useCurrentProfile();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [askingChange, setAskingChange] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [requesting, setRequesting] = useState(false);

  const lockedEmail = (profile.data?.email ?? "").trim();

  const pendingRequest = useQuery({
    queryKey: ["my-email-change-request", profile.data?.id],
    enabled: open && Boolean(profile.data?.id) && Boolean(lockedEmail),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_change_requests")
        .select("id, requested_email, status, created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!open) return;
    setPhone(profile.data?.phone ? formatPhone(profile.data.phone) : "");
    setEmail(profile.data?.email ?? "");
    setAskingChange(false);
    setNewEmail("");
  }, [open, profile.data?.phone, profile.data?.email]);

  async function save() {
    setSaving(true);
    try {
      await updateMyAccountFn({ data: { phone, email } });
      await queryClient.invalidateQueries();
      toast.success("Dados atualizados! Use o novo telefone no próximo acesso.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function requestChange() {
    setRequesting(true);
    try {
      await requestEmailChangeFn({ data: { requestedEmail: newEmail } });
      await queryClient.invalidateQueries({ queryKey: ["my-email-change-request"] });
      toast.success("Pedido enviado! A Janaina vai aprovar a troca em breve.");
      setAskingChange(false);
      setNewEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o pedido.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Configurações da conta">
          <Settings size={18} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações da conta</DialogTitle>
          <DialogDescription>
            Atualize seu número de acesso e, se quiser, cadastre um e-mail para receber os
            agendamentos direto na sua Google Agenda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-phone">Telefone / acesso</Label>
            <Input
              id="account-phone"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(35) 99999-9999"
            />
            <p className="text-xs text-muted-foreground">
              Esse número é o seu login e a sua senha no app.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-email">E-mail (opcional)</Label>
            <Input
              id="account-email"
              type="email"
              value={lockedEmail || email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@gmail.com"
              disabled={Boolean(lockedEmail)}
            />
            {lockedEmail ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Seu e-mail está fixo por segurança. Para trocar, envie um pedido — a alteração
                  vale depois da aprovação da Janaina.
                </p>
                {pendingRequest.data ? (
                  <p className="text-xs font-medium text-primary">
                    Pedido em análise: {pendingRequest.data.requested_email}
                  </p>
                ) : askingChange ? (
                  <div className="space-y-2">
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="novoemail@gmail.com"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => void requestChange()}
                        disabled={requesting || !newEmail}
                      >
                        {requesting ? "Enviando..." : "Enviar pedido"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAskingChange(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setAskingChange(true)}>
                    Solicitar troca de e-mail
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Preenchendo o e-mail, você entra como convidada no compromisso e o horário aparece
                automaticamente na sua Google Agenda. Depois de salvo, ele fica fixo.
              </p>
            )}
          </div>
          <Button className="w-full" onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
