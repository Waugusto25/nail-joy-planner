import { supabase } from "@/lib/supabase-client";

/** Antes de abrir mensagens antigas, verifica o modo automático sem expor configurações. */
export async function whatsappAutomationEnabled(): Promise<boolean> {
  const { data, error } = await supabase.rpc("whatsapp_enabled");
  if (error) return false;
  return data === true;
}