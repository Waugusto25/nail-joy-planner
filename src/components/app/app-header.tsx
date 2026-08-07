import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SALON_NAME } from "@/lib/salon";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string | undefined }) {
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
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-4">
        <div>
          <p className="text-script text-xl text-primary">{SALON_NAME}</p>
          <h1 className="font-display text-lg leading-tight">{title}</h1>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <Button variant="outline" size="sm" onClick={signOut}>
          Sair
        </Button>
      </div>
    </header>
  );
}