import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  action: z.enum(["sync", "cancel", "color", "remove", "client-future"]),
  target: z.string().uuid(),
});

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401 });
}

/**
 * Ponte da Google Agenda para deploys externos.
 *
 * O site hospedado fora da Lovable não recebe as credenciais do conector da
 * Google Agenda, então ele encaminha a operação para cá enviando o mesmo
 * token de sessão de quem clicou. Aqui validamos esse token e só permitimos a
 * operação para a administradora ou para a própria dona do atendimento.
 */
export const Route = createFileRoute("/api/public/hooks/calendar-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization") ?? "";
        if (!authorization.toLowerCase().startsWith("bearer ")) {
          return unauthorized("Sessão ausente.");
        }
        const token = authorization.slice(7).trim();
        if (token.split(".").length !== 3) return unauthorized("Sessão inválida.");

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Requisição inválida." }, { status: 400 });
        }
        const { action, target } = parsed.data;

        const { createTokenClient } = await import("@/lib/supabase-public.server");
        const supabase = createTokenClient(token);
        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        const userId = claims?.claims?.sub;
        if (claimsError || !userId) return unauthorized("Sessão inválida.");

        const { data: isAdmin } = await supabase.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        });

        if (!isAdmin) {
          // Sem privilégio administrativo, só a própria cliente pode mexer no
          // que é dela: os próprios atendimentos ou a própria agenda.
          if (action === "client-future") {
            if (target !== userId) return unauthorized("Acesso restrito.");
          } else {
            const { data: appointment } = await supabase
              .from("appointments")
              .select("id")
              .eq("id", target)
              .eq("client_id", userId)
              .maybeSingle();
            if (!appointment) return unauthorized("Acesso restrito.");
          }
        }

        const helpers = await import("@/lib/calendar-helpers.server");
        try {
          switch (action) {
            case "sync":
              return Response.json(await helpers.syncAppointmentToCalendar(target));
            case "cancel":
              return Response.json(await helpers.markAppointmentCancelledInCalendar(target));
            case "color":
              return Response.json(await helpers.syncCalendarStatusColor(target));
            case "remove":
              return Response.json(await helpers.removeAppointmentFromCalendar(target));
            case "client-future":
              return Response.json(await helpers.syncFutureAppointmentsForClient(target));
          }
        } catch (error) {
          console.error("Ponte da Google Agenda falhou", error);
          const message =
            error instanceof Error ? error.message : "Falha ao sincronizar com a Google Agenda.";
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
