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
import { PasswordInput } from "@/components/app/password-input";
import { supabase } from "@/lib/supabase-client";
import { useAppSettings } from "@/hooks/useSettings";
import { useCurrentProfile } from "@/hooks/useSession";
import { onlyDigits, setSalonContact } from "@/lib/salon";

/** Configurações exclusivas da administradora: senha, Instagram e WhatsApp oficial. */
export function AdminSettingsDialog() {
  const { session, profile } = useCurrentProfile();
  const settings = useAppSettings();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setInstagram(settings.data?.instagram_url ?? "");
    setWhatsapp(settings.data?.whatsapp_number ?? "");
  }, [open, settings.data?.instagram_url, settings.data?.whatsapp_number]);

  async function savePassword() {
    if (password !== confirmPassword) {
      setPasswordError("As senhas informadas não coincidem. Verifique e tente novamente.");
      return;
    }
    if (password.length < 6) {
      setPasswordError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setPasswordError("");
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      toast.success("Senha atualizada com sucesso!");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível trocar a senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function saveContact() {
    const digits = onlyDigits(whatsapp);
    if (digits.length < 10) {
      toast.error("Informe o WhatsApp com DDD.");
      return;
    }
    setSavingContact(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .update({ instagram_url: instagram.trim(), whatsapp_number: digits })
        .eq("id", true);
      if (error) throw new Error(error.message);
      setSalonContact({ instagram: instagram.trim(), whatsapp: digits });
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Contatos do salão atualizados em todo o aplicativo.");
    } catch {
      toast.error("Não foi possível salvar os contatos.");
    } finally {
      setSavingContact(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Configurações da administradora">
          <Settings size={18} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações da administradora</DialogTitle>
          <DialogDescription>
            Troque sua senha e atualize os contatos oficiais do studio.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="space-y-1">
              <Label>Seu acesso</Label>
              <p className="text-sm text-muted-foreground">
                {profile.data?.login_id ? `ID ${profile.data.login_id} · ` : ""}
                {session?.user.email ?? "—"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-new-password">Nova senha</Label>
              <PasswordInput
                id="admin-new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-confirm-password">Confirmar nova senha</Label>
              <PasswordInput
                id="admin-confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                maxLength={60}
              />
            </div>
            {passwordError ? (
              <p className="text-sm font-semibold text-destructive">{passwordError}</p>
            ) : null}
            <Button
              className="w-full"
              onClick={() => void savePassword()}
              disabled={savingPassword || !password || !confirmPassword}
            >
              {savingPassword ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </section>

          <section className="space-y-3 border-t border-border/70 pt-5">
            <div className="space-y-1.5">
              <Label htmlFor="admin-instagram">Link do Instagram</Label>
              <Input
                id="admin-instagram"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="https://www.instagram.com/seuperfil"
              />
              <p className="text-xs text-muted-foreground">
                Esse link passa a valer no botão do Instagram da tela de acesso.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-whatsapp">WhatsApp oficial do salão</Label>
              <Input
                id="admin-whatsapp"
                inputMode="numeric"
                value={whatsapp}
                onChange={(e) => setWhatsapp(onlyDigits(e.target.value))}
                maxLength={13}
                placeholder="35998844504"
              />
              <p className="text-xs text-muted-foreground">
                Atualiza todos os links e mensagens enviadas para o salão.
              </p>
            </div>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => void saveContact()}
              disabled={savingContact}
            >
              {savingContact ? "Salvando..." : "Salvar contatos"}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
