import { AUTH_EMAIL_DOMAIN } from "./salon";

type SessionUserLike = {
  email?: string | null;
  app_metadata?: { provider?: unknown; providers?: unknown } | null;
};

/**
 * Sessão Google "ponte": a conta da cliente continua sendo a conta interna por
 * telefone (onde vivem agendamentos, fidelidade e pedidos). A sessão Google só
 * serve para provar a identidade e é trocada pela conta interna logo depois.
 */
export function isGoogleBridgeSession(user: SessionUserLike | null | undefined): boolean {
  if (!user) return false;
  const email = String(user.email ?? "").toLowerCase();
  if (email.endsWith(`@${AUTH_EMAIL_DOMAIN}`)) return false;
  const meta = user.app_metadata ?? {};
  const providers = Array.isArray(meta.providers) ? meta.providers : [];
  return meta.provider === "google" || providers.includes("google");
}
