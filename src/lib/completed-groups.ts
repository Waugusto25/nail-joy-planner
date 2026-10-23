// Agrupa atendimentos concluídos por cliente + dia, para a aba Concluídos
// mostrar uma linha por visita em vez de um card por procedimento.

export type CompletedAppointmentLike = {
  id: string;
  client_id: string | null;
  day: string;
  start_time: string;
  price_cents: number | null;
  serviceName: string;
};

export type CompletedGroup<T extends CompletedAppointmentLike> = {
  key: string;
  clientId: string | null;
  day: string;
  firstStart: string;
  totalCents: number;
  serviceNames: string[];
  items: T[];
};

export function groupCompletedAppointments<T extends CompletedAppointmentLike>(
  rows: readonly T[],
): CompletedGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const key = `${r.client_id ?? r.id}|${r.day}`;
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  const groups: CompletedGroup<T>[] = [...map.entries()].map(([key, list]) => {
    const items = list
      .slice()
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    const first = items[0] as T;
    return {
      key,
      clientId: first.client_id,
      day: first.day,
      firstStart: first.start_time,
      totalCents: items.reduce((s, i) => s + Number(i.price_cents ?? 0), 0),
      serviceNames: [...new Set(items.map((i) => i.serviceName))],
      items,
    };
  });
  // Mais recente primeiro; no mesmo dia, pelo primeiro horário.
  return groups.sort((a, b) =>
    a.day === b.day ? a.firstStart.localeCompare(b.firstStart) : b.day.localeCompare(a.day),
  );
}
