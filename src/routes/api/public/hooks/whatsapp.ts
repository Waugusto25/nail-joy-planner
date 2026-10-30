import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: { handlers: { POST: async ({ request }) => {
    const token = request.headers.get("x-service-token");
    if (!token) return new Response("Unauthorized", { status: 401 });
    try {
      const { processWhatsapp } = await import("@/lib/evolution.server");
      return Response.json(await processWhatsapp(token));
    } catch { return new Response("Request rejected", { status: 403 }); }
  } } },
});