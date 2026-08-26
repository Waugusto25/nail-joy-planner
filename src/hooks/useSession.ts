import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase-client";

export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, ready };
}

export function useCurrentProfile() {
  const { session, ready } = useSupabaseSession();
  const userId = session?.user.id;

  const profile = useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [{ data: row, error }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, login_id, phone, email, welcome_seen")
          .eq("id", userId!)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      if (error) throw error;
      return {
        ...row,
        isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      } as {
        id: string;
        full_name: string;
        login_id: string;
        phone: string;
        email: string | null;
        welcome_seen: boolean;
        isAdmin: boolean;
      };
    },
  });

  return { session, sessionReady: ready, profile };
}