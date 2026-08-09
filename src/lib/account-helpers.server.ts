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

  // O e-mail fica fixo depois de cadastrado: só muda com aprovação da administradora.
  const { data: current } = await db
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const lockedEmail = String(current?.email ?? "").trim();
  const nextEmail = lockedEmail ? lockedEmail : email || null;

  const { error } = await db.from("profiles").update({ phone, email: nextEmail }).eq("id", userId);
  if (error) throw new Error("Não foi possível salvar seus dados.");

  const { error: authError } = await db.auth.admin.updateUserById(userId, { password: phone });
  if (authError) throw new Error("Não foi possível atualizar seu acesso.");
  return { ok: true as const };
}

/** Registra o pedido de troca de e-mail para aprovação manual da administradora. */

/** Salva o e-mail da Google Agenda pelo pop-up de acesso (só se ainda não houver). */
export async function setMyCalendarEmail(userId: string, email: string) {
  const db = admin();
  const { data: current } = await db
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (String(current?.email ?? "").trim()) {
    throw new Error("Você já tem um e-mail cadastrado. Solicite a troca nas configurações.");
  }
  const { error } = await db
    .from("profiles")
    .update({ email, calendar_prompt_dismissed: true })
    .eq("id", userId);
  if (error) throw new Error("Não foi possível salvar seu e-mail.");
  return { ok: true as const };
}

/** Marca que a cliente não quer mais ver o aviso da Google Agenda. */
export async function dismissCalendarPrompt(userId: string) {
  const db = admin();
  const { error } = await db
    .from("profiles")
    .update({ calendar_prompt_dismissed: true })
    .eq("id", userId);
  if (error) throw new Error("Não foi possível salvar sua preferência.");
  return { ok: true as const };
}

export async function requestEmailChange(userId: string, requestedEmail: string) {
  const db = admin();
  const { data: profile } = await db
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const currentEmail = String(profile?.email ?? "").trim();
  if (currentEmail === requestedEmail) {
    throw new Error("Esse já é o e-mail cadastrado.");
  }
  const { data: pending } = await db
    .from("email_change_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pendente")
    .maybeSingle();
  if (pending) throw new Error("Você já tem um pedido de troca aguardando aprovação.");

  const { error } = await db.from("email_change_requests").insert({
    user_id: userId,
    current_email: currentEmail || null,
    requested_email: requestedEmail,
  });
  if (error) throw new Error("Não foi possível registrar o pedido.");
  return { ok: true as const };
}

/** Aprova (aplicando o novo e-mail) ou recusa um pedido de troca de e-mail. */
export async function decideEmailChange(requestId: string, approve: boolean) {
  const db = admin();
  const { data: request } = await db
    .from("email_change_requests")
    .select("id, user_id, requested_email, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) throw new Error("Pedido não encontrado.");
  if (request.status !== "pendente") throw new Error("Esse pedido já foi decidido.");

  if (approve) {
    const { error } = await db
      .from("profiles")
      .update({ email: request.requested_email })
      .eq("id", request.user_id);
    if (error) throw new Error("Não foi possível atualizar o e-mail da cliente.");
  }

  await db
    .from("email_change_requests")
    .update({ status: approve ? "aprovado" : "recusado", decided_at: new Date().toISOString() })
    .eq("id", requestId);
  return { ok: true as const, approved: approve };
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
