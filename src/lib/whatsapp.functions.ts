import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireServerSupabaseAuth } from "./supabase-auth-middleware";
import { whatsappConfigSchema } from "./whatsapp-rules";

export const whatsappSettingsFn = createServerFn({ method: "GET" }).middleware([requireServerSupabaseAuth]).handler(async ({ context }) => {
  const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!role.data) throw new Error("Acesso restrito.");
  const settings = await context.supabase.from("whatsapp_settings").select("*").eq("id", true).maybeSingle();
  const logs = await context.supabase.from("whatsapp_messages").select("id,kind,status,created_at,last_error").order("created_at", { ascending: false }).limit(20);
  if (settings.error || logs.error) throw new Error("Não foi possível carregar o WhatsApp.");
  return { settings: settings.data, logs: logs.data || [], keyConfigured: Boolean(process.env["EVOLUTION_API_KEY"]) };
});

export const saveWhatsappSettingsFn = createServerFn({ method: "POST" }).middleware([requireServerSupabaseAuth]).inputValidator((d: unknown) => whatsappConfigSchema.parse(d)).handler(async ({ context, data }) => {
  const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!role.data) throw new Error("Acesso restrito.");
  if (data.enabled && !process.env["EVOLUTION_API_KEY"]) throw new Error("Configure a chave antes de ativar.");
  const previous = await context.supabase.from("whatsapp_settings").select("activated_at").eq("id", true).maybeSingle();
  const result = await context.supabase.from("whatsapp_settings").upsert({ id: true, ...data, activated_at: previous.data?.activated_at || (data.enabled ? new Date().toISOString() : null), updated_at: new Date().toISOString() });
  if (result.error) throw new Error("Não foi possível salvar.");
  return { ok: true };
});

export const testWhatsappFn = createServerFn({ method: "POST" }).middleware([requireServerSupabaseAuth]).inputValidator((d: unknown) => whatsappConfigSchema.extend({ phone: z.string().min(10).max(25) }).parse(d)).handler(async ({ context, data }) => {
  const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!role.data) throw new Error("Acesso restrito.");
  const { sendEvolution } = await import("./evolution.server");
  await sendEvolution(data, data.phone, "Jannah Nails 💖 Conexão de WhatsApp testada com sucesso.");
  return { ok: true };
});

export const whatsappContactFn = createServerFn({ method: "POST" }).middleware([requireServerSupabaseAuth]).inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d)).handler(async ({ context, data }) => {
  const { error } = await context.supabase.rpc("whatsapp_admin_enqueue", { p_kind: "contact", p_id: data.clientId });
  if (error) throw new Error("Não foi possível enviar a saudação.");
  return { ok: true };
});