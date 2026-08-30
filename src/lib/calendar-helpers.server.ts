import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BENEFIT_LABELS,
  SALON_ADDRESS,
  addMinutes,
  formatDayLabel,
  formatPhone,
  formatPrice,
  shortTime,
} from "./salon";
import { createAdminClient } from "./supabase-admin.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
/** Agenda da administradora onde os atendimentos são publicados. */
export const CALENDAR_ID = "jannahsilva.oliveira@gmail.com";
const TIME_ZONE = "America/Sao_Paulo";

/**
 * Hospedagem onde as credenciais do conector da Google Agenda existem.
 * Deploys externos (ex.: Vercel) não recebem essas credenciais, então
 * encaminhamos a operação para cá.
 */
const CALENDAR_BRIDGE_BASE = "https://nail-joy-planner.lovable.app";
const BRIDGE_MARKER = "x-calendar-bridge";

/** Padrão visual por status na Google Agenda: azul, amarelo, verde e vermelho. */
export const STATUS_COLOR_ID: Record<string, string> = {
  pendente: "9",
  confirmado: "5",
  concluido: "10",
  cancelado: "11",
};

function admin(): SupabaseClient {
  return createAdminClient();
}

/** Só a hospedagem com as credenciais do conector fala direto com a Google. */
function hasGatewayCredentials(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["GOOGLE_CALENDAR_API_KEY"]);
}

function currentRequestHeaders(): Headers | null {
  try {
    return getRequest()?.headers ?? null;
  } catch {
    return null;
  }
}

export type CalendarBridgeAction = "sync" | "cancel" | "color" | "remove" | "client-future";

/**
 * Encaminha a operação para a hospedagem que tem a Google Agenda conectada.
 * Retorna `null` quando não é possível/necessário usar a ponte, e nesse caso o
 * fluxo segue localmente (ou falha com o erro original).
 */
async function bridge(
  action: CalendarBridgeAction,
  target: string,
): Promise<Record<string, unknown> | null> {
  if (hasGatewayCredentials()) return null;
  const headers = currentRequestHeaders();
  // Evita laço infinito: se já somos o destino da ponte, não reencaminhamos.
  if (headers?.get(BRIDGE_MARKER)) return null;
  const authorization = headers?.get("authorization");
  if (!authorization) return null;

  const base = process.env["CALENDAR_BRIDGE_URL"]?.replace(/\/+$/, "") || CALENDAR_BRIDGE_BASE;
  const response = await fetch(`${base}/api/public/hooks/calendar-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
      [BRIDGE_MARKER]: "1",
    },
    body: JSON.stringify({ action, target }),
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const detail = typeof payload?.["error"] === "string" ? String(payload["error"]) : "";
    throw new Error(detail || `Google Agenda recusou a operação (${response.status}).`);
  }
  return payload ?? {};
}

function gatewayHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_CALENDAR_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Agenda não está conectada nesta hospedagem.");
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
  status: string;
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
      "id, client_id, day, start_time, status, price_cents, benefit_type, discount_percent, notes, google_event_id, services(name, duration_minutes)",
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
    .select("full_name, phone, email")
    .eq("id", appt.client_id)
    .maybeSingle();

  const serviceName = appt.services?.name ?? "Procedimento";
  const duration = Number(appt.services?.duration_minutes ?? 60);
  const start = shortTime(appt.start_time);
  const end = addMinutes(start, duration);
  const clientName = String(client?.full_name ?? "Cliente");
  const phone = String(client?.phone ?? "");
  const clientEmail = String(client?.email ?? "").trim();

  const descriptionLines = [
    `Procedimento: ${serviceName}`,
    `Data: ${formatDayLabel(appt.day)}`,
    `Horário: ${start} às ${end}`,
    `Local: ${SALON_ADDRESS}`,
    phone ? `WhatsApp: ${formatPhone(phone)}` : null,
    `Valor a cobrar: ${formatPrice(Number(appt.price_cents))}`,
    appt.discount_percent > 0
      ? `Cupom aplicado: ${BENEFIT_LABELS[appt.benefit_type] ?? "Desconto"} (-${appt.discount_percent}%)`
      : "Cupom aplicado: nenhum",
    appt.notes ? `Observações: ${appt.notes}` : null,
  ].filter(Boolean);

  const body = {
    summary: `${appt.status === "cancelado" ? "CANCELADO — " : ""}${clientName} — ${serviceName}`,
    description: descriptionLines.join("\n"),
    location: SALON_ADDRESS,
    start: { dateTime: `${appt.day}T${start}:00`, timeZone: TIME_ZONE },
    end: { dateTime: `${appt.day}T${end}:00`, timeZone: TIME_ZONE },
    colorId: STATUS_COLOR_ID[appt.status] ?? STATUS_COLOR_ID["pendente"]!,
    // Com e-mail cadastrado, a cliente entra como convidada e o compromisso
    // aparece automaticamente na Google Agenda dela. Sem e-mail, ignoramos.
    ...(clientEmail ? { attendees: [{ email: clientEmail, displayName: clientName }] } : {}),
  };

  const encodedCalendar = encodeURIComponent(CALENDAR_ID);
  if (appt.google_event_id) {
    await gateway(
      `/calendars/${encodedCalendar}/events/${encodeURIComponent(appt.google_event_id)}?sendUpdates=all`,
      { method: "PATCH", body },
    );
    return { eventId: appt.google_event_id };
  }

  const created = (await gateway(`/calendars/${encodedCalendar}/events?sendUpdates=all`, {
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
/**
 * Sincronização retroativa: republica na Google Agenda todos os atendimentos
 * futuros e ativos da cliente, para que o e-mail recém-cadastrado entre como
 * convidado e os horários já marcados apareçam na agenda dela.
 */
export async function syncFutureAppointmentsForClient(clientId: string) {
  const db = admin();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from("appointments")
    .select("id")
    .eq("client_id", clientId)
    .gte("day", today)
    .in("status", ["pendente", "confirmado"]);
  let synced = 0;
  for (const row of data ?? []) {
    try {
      await syncAppointmentToCalendar(String(row.id));
      synced += 1;
    } catch (error) {
      console.error("Falha na sincronização retroativa da Google Agenda", error);
    }
  }
  return { synced };
}

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

/**
 * Mantém o histórico do cancelamento na agenda: pinta o evento de vermelho e
 * marca o título como CANCELADO, avisando a cliente convidada.
 */
export async function markAppointmentCancelledInCalendar(appointmentId: string) {
  const db = admin();
  const appt = await loadAppointment(db, appointmentId);
  if (!appt.google_event_id) return { updated: false };
  const clientName = await db
    .from("profiles")
    .select("full_name")
    .eq("id", appt.client_id)
    .maybeSingle()
    .then((r) => String(r.data?.full_name ?? "Cliente"));
  const serviceName = appt.services?.name ?? "Procedimento";
  await gateway(
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(String(appt.google_event_id))}?sendUpdates=all`,
    {
      method: "PATCH",
      body: {
        summary: `CANCELADO — ${clientName} — ${serviceName}`,
        colorId: STATUS_COLOR_ID["cancelado"]!,
        status: "confirmed",
      },
    },
  );
  return { updated: true };
}

/**
 * Atualiza apenas a cor do compromisso conforme o status atual do atendimento.
 * Se o evento ainda não existir na agenda, cria o compromisso completo.
 */
export async function syncCalendarStatusColor(appointmentId: string) {
  const db = admin();
  const { data } = await db
    .from("appointments")
    .select("status, google_event_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!data) throw new Error("Agendamento não encontrado.");
  const colorId = STATUS_COLOR_ID[String(data.status)];
  if (!colorId) return { updated: false };
  if (String(data.status) === "cancelado") {
    await markAppointmentCancelledInCalendar(appointmentId);
    return { updated: true };
  }
  if (!data.google_event_id) {
    await syncAppointmentToCalendar(appointmentId);
    return { updated: true };
  }
  await gateway(
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(String(data.google_event_id))}`,
    { method: "PATCH", body: { colorId } },
  );
  return { updated: true };
}
