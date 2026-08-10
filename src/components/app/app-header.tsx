import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PushBell } from "@/components/app/push-toggle";
import { AccountSettingsDialog } from "@/components/app/account-settings-dialog";
import { AdminSettingsDialog } from "@/components/app/admin-settings-dialog";
import { supabase } from "@/integrations/supabase/client";
import { SALON_NAME } from "@/lib/salon";

export function AppHeader({
  title,
  subtitle,
  audience,
}: {
  title: string;
  subtitle?: string | undefined;
  audience?: "admin" | "cliente";
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  }

  return (
    <header className="glass-header sticky top-0 z-40">
      <div className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-script text-lg leading-tight text-primary">{SALON_NAME}</p>
          <h1 className="truncate font-display text-base leading-tight sm:text-lg">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {audience ? <PushBell audience={audience} /> : null}
          {audience === "cliente" ? <AccountSettingsDialog /> : null}
          {audience === "admin" ? <AdminSettingsDialog /> : null}
          <Button variant="ghost" size="icon" aria-label="Sair da conta" onClick={signOut}>
            <LogOut size={18} />
          </Button>
        </div>
      </div>
    </header>
  );
}
