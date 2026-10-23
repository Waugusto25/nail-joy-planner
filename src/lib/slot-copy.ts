export type SlotCopyMode = "replace" | "merge";

export interface SlotRow {
  readonly id: string;
  readonly weekday: number;
  readonly start_time: string;
}

export interface SlotCopyPlan {
  readonly deleteIds: string[];
  readonly inserts: { weekday: number; start_time: string }[];
}

/**
 * Pure plan for copying one day's times to other days.
 * Replace: removes target times not in the source; merge: keeps them.
 * Times already present are never re-inserted (avoids duplicates).
 */
export function planSlotCopy(
  rows: readonly SlotRow[],
  sourceDay: number,
  targetDays: readonly number[],
  mode: SlotCopyMode,
): SlotCopyPlan {
  const sourceTimes = new Set(rows.filter((r) => r.weekday === sourceDay).map((r) => r.start_time));
  const deleteIds: string[] = [];
  const inserts: { weekday: number; start_time: string }[] = [];
  for (const day of targetDays) {
    if (day === sourceDay) continue;
    const existing = rows.filter((r) => r.weekday === day);
    const existingTimes = new Set(existing.map((r) => r.start_time));
    if (mode === "replace") {
      for (const r of existing) if (!sourceTimes.has(r.start_time)) deleteIds.push(r.id);
    }
    for (const t of [...sourceTimes].sort()) {
      if (!existingTimes.has(t)) inserts.push({ weekday: day, start_time: t });
    }
  }
  return { deleteIds, inserts };
}
