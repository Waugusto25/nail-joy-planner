import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function admin(): SupabaseClient {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Atualiza o telefone de acesso (que também é a senha) e o e-mail opcional
 * usado para convidar a cliente no compromisso da Google Agenda.
 */
export async function updateMyAccount(userId: string, phone: string, email: string) {
  const db = admin();
  const { data: taken } = await db
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .neq("id", userId)
    .maybeSingle();
  if (taken) throw new Error("Esse telefone já está cadastrado em outra conta.");

  const { error } = await db
    .from("profiles")
    .update({ phone, email: email || null })
    .eq("id", userId);
  if (error) throw new Error("Não foi possível salvar seus dados.");

  const { error: authError } = await db.auth.admin.updateUserById(userId, { password: phone });
  if (authError) throw new Error("Não foi possível atualizar seu acesso.");
  return { ok: true as const };
}

/** Marca o prêmio do sorteio como reivindicado no pré-agendamento informado. */
export async function claimEventPrize(userId: string, eventId: string, appointmentId: string) {
  const db = admin();
  const { data: event } = await db
    .from("events")
    .select("id, winner_id, prize_claimed_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || String(event.winner_id) !== userId) throw new Error("Você não é a ganhadora deste evento.");
  if (event.prize_claimed_at) throw new Error("Este prêmio já foi reivindicado.");
  await db
    .from("events")
    .update({ prize_claimed_at: new Date().toISOString(), prize_claimed_appointment_id: appointmentId })
    .eq("id", eventId);
  return { ok: true as const };
}
