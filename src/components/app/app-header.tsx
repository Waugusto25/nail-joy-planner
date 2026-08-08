import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { PushBell } from "@/components/app/push-toggle";
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
    <header className="border-b border-border/70 bg-card/80 backdrop-blur">
      <div className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4">
        <div className="min-w-0">
          <p className="text-script text-xl text-primary">{SALON_NAME}</p>
          <h1 className="truncate font-display text-lg leading-tight">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {audience ? <PushBell audience={audience} /> : null}
          <Button variant="outline" size="sm" onClick={signOut}>
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
