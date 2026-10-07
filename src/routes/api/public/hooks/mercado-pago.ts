import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Recebe notificações do Mercado Pago. O corpo serve só para obter o ID;
// o status real é sempre consultado na API do Mercado Pago antes da baixa.
const bodySchema = z.object({
  type: z.string().optional(),
  action: z.string().optional(),
  data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
});

export const Route = createFileRoute("/api/public/hooks/mercado-pago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["MERCADO_PAGO_ACCESS_TOKEN"];
        if (!token) return new Response("not configured", { status: 500 });

        const url = new URL(request.url);
        let id = url.searchParams.get("data.id") ?? url.searchParams.get("id");
        let topic = url.searchParams.get("type") ?? url.searchParams.get("topic");
        try {
          const parsed = bodySchema.safeParse(await request.json());
          if (parsed.success) {
            id = parsed.data.data?.id ? String(parsed.data.data.id) : id;
            topic = parsed.data.type ?? topic;
          }
        } catch {
          // corpo vazio: usa a query string
        }
        if (!id || !/^\d{1,20}$/.test(id) || (topic && topic !== "payment")) {
          return new Response("ignored", { status: 200 });
        }

        try {
          const { fetchMpPayment, settleFromMpPayment } = await import("@/lib/mercado-pago-settle.server");
          const payment = await fetchMpPayment(id, token);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const result = await settleFromMpPayment(supabaseAdmin, payment);
          return Response.json({ ok: true, result });
        } catch (e) {
          console.error("MP webhook", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
