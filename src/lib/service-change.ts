/** Regras puras da troca de procedimento num agendamento (sem acesso ao banco). */

export type BusyRow = { start_time: string; duration_minutes: number; client_name?: string };

export type DelayConflict = {
  clientName: string;
  startTime: string; // "HH:MM"
  overlapMinutes: number;
};

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * Atendimentos que começam depois do início deste e antes do novo término.
 * Só esses sofrem atraso; os anteriores não são afetados pela troca.
 */
export function findDelayConflicts(
  startTime: string,
  newDuration: number,
  others: BusyRow[],
): DelayConflict[] {
  const start = toMinutes(startTime);
  const end = start + newDuration;
  return others
    .map((o) => ({ o, s: toMinutes(o.start_time) }))
    .filter(({ s }) => s >= start && s < end)
    .sort((a, b) => a.s - b.s)
    .map(({ o, s }) => ({
      clientName: o.client_name ?? "Cliente",
      startTime: toHHMM(s),
      overlapMinutes: end - s,
    }));
}

/** Novo valor do atendimento, mantendo o desconto percentual que a cliente já tinha. */
export function newPriceCents(servicePriceCents: number, discountPercent: number): number {
  const pct = Math.min(Math.max(discountPercent, 0), 100);
  return Math.round((servicePriceCents * (100 - pct)) / 100);
}

export function endTime(startTime: string, duration: number): string {
  return toHHMM(toMinutes(startTime) + duration);
}
