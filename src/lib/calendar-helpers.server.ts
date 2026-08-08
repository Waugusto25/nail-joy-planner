import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { BENEFIT_LABELS, addMinutes, formatPhone, formatPrice, shortTime } from "./salon";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
/** Agenda da administradora onde os atendimentos são publicados. */
export const CALENDAR_ID = "jannahsilva.oliveira@gmail.com";
const TIME_ZONE = "America/Sao_Paulo";

function admin(): SupabaseClient {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function gatewayHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_CALENDAR_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Agenda não está conectada.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
    "Content-Type": "application/json",
  };
}

async function gateway(path: string, init: { method: string; body?: unknown }) {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method: init.method,
    headers: gatewayHeaders(),
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error(`Google Agenda falhou [${response.status}]: ${detail}`);
    throw new Error(`Google Agenda recusou a operação (${response.status}).`);
  }
  return response.status === 204 ? null : await response.json();
}

type AppointmentRow = {
  id: string;
  client_id: string;
  day: string;
  start_time: string;
  price_cents: number;
  benefit_type: string;
  discount_percent: number;
  notes: string | null;
  google_event_id: string | null;
  services: { name: string; duration_minutes: number } | null;
};

async function loadAppointment(db: SupabaseClient, appointmentId: string) {
  const { data } = await db
    .from("appointments")
    .select(
      "id, client_id, day, start_time, price_cents, benefit_type, discount_percent, notes, google_event_id, services(name, duration_minutes)",
    )
    .eq("id", appointmentId)
    .maybeSingle();
  if (!data) throw new Error("Agendamento não encontrado.");
  const joined = (data as { services: unknown }).services;
  return {
    ...(data as unknown as AppointmentRow),
    services: (Array.isArray(joined) ? joined[0] : joined) as AppointmentRow["services"],
  };
}

/** Cria (ou atualiza) o compromisso na Google Agenda para um atendimento confirmado. */
export async function syncAppointmentToCalendar(appointmentId: string) {
  const db = admin();
  const appt = await loadAppointment(db, appointmentId);
  const { data: client } = await db
    .from("profiles")
    .select("full_name, phone")
    .eq("id", appt.client_id)
    .maybeSingle();

  const serviceName = appt.services?.name ?? "Procedimento";
  const duration = Number(appt.services?.duration_minutes ?? 60);
  const start = shortTime(appt.start_time);
  const end = addMinutes(start, duration);
  const clientName = String(client?.full_name ?? "Cliente");
  const phone = String(client?.phone ?? "");

  const descriptionLines = [
    phone ? `WhatsApp: ${formatPhone(phone)}` : null,
    `Valor a cobrar: ${formatPrice(Number(appt.price_cents))}`,
    appt.discount_percent > 0
      ? `Cupom aplicado: ${BENEFIT_LABELS[appt.benefit_type] ?? "Desconto"} (-${appt.discount_percent}%)`
      : "Cupom aplicado: nenhum",
    appt.notes ? `Observações: ${appt.notes}` : null,
  ].filter(Boolean);

  const body = {
    summary: `${clientName} — ${serviceName}`,
    description: descriptionLines.join("\n"),
    start: { dateTime: `${appt.day}T${start}:00`, timeZone: TIME_ZONE },
    end: { dateTime: `${appt.day}T${end}:00`, timeZone: TIME_ZONE },
  };

  const encodedCalendar = encodeURIComponent(CALENDAR_ID);
  if (appt.google_event_id) {
    await gateway(`/calendars/${encodedCalendar}/events/${encodeURIComponent(appt.google_event_id)}`, {
      method: "PATCH",
      body,
    });
    return { eventId: appt.google_event_id };
  }

  const created = (await gateway(`/calendars/${encodedCalendar}/events`, {
    method: "POST",
    body,
  })) as { id?: string } | null;
  const eventId = created?.id ?? null;
  if (eventId) {
    await db.from("appointments").update({ google_event_id: eventId }).eq("id", appointmentId);
  }
  return { eventId };
}

/** Remove o compromisso da Google Agenda (usado ao cancelar o atendimento). */
export async function removeAppointmentFromCalendar(appointmentId: string) {
  const db = admin();
  const { data } = await db
    .from("appointments")
    .select("google_event_id")
    .eq("id", appointmentId)
    .maybeSingle();
  const eventId = data?.google_event_id;
  if (!eventId) return { removed: false };
  await gateway(
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(String(eventId))}`,
    { method: "DELETE" },
  );
  await db.from("appointments").update({ google_event_id: null }).eq("id", appointmentId);
  return { removed: true };
}
