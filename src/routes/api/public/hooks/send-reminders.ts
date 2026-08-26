import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // O token de serviço é validado dentro das funções do banco; aqui só
        // recusamos chamadas sem credencial.
        const serviceToken =
          request.headers.get("x-service-token") ?? process.env["REMINDERS_SERVICE_TOKEN"] ?? "";
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "");
        const accepted = [
          process.env["SUPABASE_ANON_KEY"],
          process.env["SUPABASE_PUBLISHABLE_KEY"],
        ].filter(Boolean);
        if (!serviceToken || (!apiKey && accepted.length > 0)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { sendDueReminders } = await import("@/lib/push-helpers.server");
        const result = await sendDueReminders(serviceToken);
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
