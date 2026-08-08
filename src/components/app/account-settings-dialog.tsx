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
import { updateMyAccountFn } from "@/lib/account.functions";
import { formatPhone } from "@/lib/salon";

/** Configurações da conta da cliente: telefone de acesso e e-mail opcional. */
export function AccountSettingsDialog() {
  const { profile } = useCurrentProfile();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhone(profile.data?.phone ? formatPhone(profile.data.phone) : "");
    setEmail(profile.data?.email ?? "");
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@gmail.com"
            />
            <p className="text-xs text-muted-foreground">
              Preenchendo o e-mail, você entra como convidada no compromisso e o horário aparece
              automaticamente na sua Google Agenda. Deixe em branco para não usar.
            </p>
          </div>
          <Button className="w-full" onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
