/**
 * The five tracked habits and their day-by-day log.
 *
 * Hardcoded for now. Library gains add/edit/delete later; nothing here assumes
 * the list is fixed beyond the exported constant, so that change is additive.
 *
 * localStorage only in this slice. No Supabase table, so nothing to migrate.
 */

import type { Habit, HabitLogMap } from '../types/habits';
import { startOfWeek, endOfWeek } from '../utils/week';
import { formatLocalDate } from './storage';

const HABIT_LOGS_KEY = 'habit_logs';

export const HABITS: Habit[] = [
  { id: 'walk', name: 'Walk',         cadence: { kind: 'daily' },                   heldByDefault: false, order: 0 },
  { id: 'dog',  name: 'Walk the dog', cadence: { kind: 'daily' },                   heldByDefault: false, order: 1 },
  { id: 'dry',  name: 'Dry day',      cadence: { kind: 'daily-quota', perWeek: 5 }, heldByDefault: true,  order: 2 },
  { id: 'lift', name: 'Lift',         cadence: { kind: 'weekly', perWeek: 3 },      heldByDefault: false, order: 3 },
  { id: 'run',  name: 'Run',          cadence: { kind: 'weekly', perWeek: 1 },      heldByDefault: false, order: 4 },
];

/** The habits that make up a day's completion score. Always three. */
export function dailyHabits(): Habit[] {
  return HABITS.filter(h => h.cadence.kind !== 'weekly');
}

/** The habits owed a number of times per week, on no particular day. */
export function weeklyHabits(): Habit[] {
  return HABITS.filter(h => h.cadence.kind === 'weekly');
}

export function loadHabitLogs(): HabitLogMap {
  try {
    const raw = localStorage.getItem(HABIT_LOGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as HabitLogMap) : {};
  } catch {
    return {};
  }
}

export function saveHabitLogs(logs: HabitLogMap): void {
  localStorage.setItem(HABIT_LOGS_KEY, JSON.stringify(logs));
}

/**
 * Whether a habit counts as done on a date. An absent entry means the habit's
 * default, which is true only for inverted habits like the dry day.
 */
export function isHabitDone(habit: Habit, dateStr: string, logs: HabitLogMap): boolean {
  const explicit = logs[dateStr]?.[habit.id];
  return explicit === undefined ? habit.heldByDefault : explicit;
}

/** Write one habit's state for one date. Returns the updated map. */
export function setHabitDone(habitId: string, dateStr: string, done: boolean): HabitLogMap {
  const logs = loadHabitLogs();
  const next: HabitLogMap = { ...logs, [dateStr]: { ...(logs[dateStr] ?? {}), [habitId]: done } };
  saveHabitLogs(next);
  return next;
}

/** Flip a habit's state for one date. Returns the updated map. */
export function toggleHabit(habit: Habit, dateStr: string): HabitLogMap {
  const current = isHabitDone(habit, dateStr, loadHabitLogs());
  return setHabitDone(habit.id, dateStr, !current);
}

/**
 * How many days in the containing Monday-to-Sunday week the habit was done.
 * Counts the whole week, future days included, because an inverted habit is
 * held on days that have not happened yet and its quota is a weekly budget.
 */
export function countDoneInWeek(habit: Habit, date: Date, logs: HabitLogMap): number {
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  let count = 0;
  for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    if (isHabitDone(habit, formatLocalDate(d), logs)) count++;
  }
  return count;
}
