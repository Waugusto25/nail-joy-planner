import { overlaps, shortTime, timeToMinutes } from "./salon";

export type ManualSchedule = {
  slots: { weekday: number; start_time: string }[];
  breaks: { weekday: number; start_time: string; end_time: string }[];
  blocked: string[];
  special: { day: string; times: string[] }[];
  busy: { day: string; start_time: string; duration: number }[];
  monthActive: boolean;
};

export function manualWeekday(day: string): number {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(year, month - 1, date).getDay();
}

export function manualTimeConflict(schedule: ManualSchedule, day: string, time: string, duration: number): boolean {
  const start = timeToMinutes(time);
  return start + duration > 1440 || schedule.busy.some((b) => b.day === day &&
    overlaps(start, start + duration, timeToMinutes(b.start_time), timeToMinutes(b.start_time) + b.duration));
}

/** Mesmas prioridades da cliente: dia especial substitui grade e intervalos semanais. */
export function manualAvailableTimes(schedule: ManualSchedule, day: string, duration: number, today: string, minStart: number): string[] {
  if (!schedule.monthActive || day < today) return [];
  const special = schedule.special.find((s) => s.day === day && s.times.length > 0);
  if (!special && schedule.blocked.includes(day)) return [];
  const weekday = manualWeekday(day);
  const times = special?.times ?? schedule.slots.filter((s) => s.weekday === weekday).map((s) => s.start_time);
  return [...new Set(times.map(shortTime))].filter((time) => {
    const start = timeToMinutes(time);
    if (day === today && start < minStart) return false;
    if (manualTimeConflict(schedule, day, time, duration)) return false;
    return special || !schedule.breaks.some((b) => b.weekday === weekday &&
      overlaps(start, start + duration, timeToMinutes(b.start_time), timeToMinutes(b.end_time)));
  }).sort();
}