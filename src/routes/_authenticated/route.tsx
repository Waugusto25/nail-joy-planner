import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/lib/supabase-client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  // Sem SSR, a checagem de sessão roda no cliente: mostra um estado de carregamento
  // em vez de tela branca enquanto o Supabase responde.
  pendingComponent: () => (
    <div className="bg-petal grid min-h-screen place-items-center px-4">
      <p className="text-sm text-muted-foreground">Carregando seu painel...</p>
    </div>
  ),
  component: () => <Outlet />,

});
