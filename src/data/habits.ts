/**
 * The five tracked habits and their day-by-day log.
 *
 * Hardcoded for now. Library gains add/edit/delete later; nothing here assumes
 * the list is fixed beyond the exported constant, so that change is additive.
 *
 * localStorage only in this slice. No Supabase table, so nothing to migrate.
 */

import type { Habit, HabitCadence, HabitLogMap } from '../types/habits';
import { startOfWeek, endOfWeek } from '../utils/week';
import { formatLocalDate } from './storage';
import { generateUUID } from '../utils/uuid';

const HABIT_LOGS_KEY = 'habit_logs';
const HABIT_DEFS_KEY = 'habit_definitions';
const HABITS_SEEDED_KEY = 'habit_definitions_seeded';

/** What a new install starts with. Editable from Library once it is seeded. */
export const DEFAULT_HABITS: Habit[] = [
  { id: 'walk', name: 'Walk',         cadence: { kind: 'daily' },                   heldByDefault: false, icon: 'directions_walk', order: 0 },
  { id: 'dog',  name: 'Walk the dog', cadence: { kind: 'daily' },                   heldByDefault: false, icon: 'pets',            order: 1 },
  { id: 'dry',  name: 'Dry day',      cadence: { kind: 'daily-quota', perWeek: 5 }, heldByDefault: true,  icon: 'no_drinks',       order: 2 },
  { id: 'lift', name: 'Lift',         cadence: { kind: 'weekly', perWeek: 3 },      heldByDefault: false, icon: 'fitness_center',  order: 3 },
  { id: 'run',  name: 'Run',          cadence: { kind: 'weekly', perWeek: 1 },      heldByDefault: false, icon: 'directions_run',  order: 4 },
];

/**
 * The icons offered in the picker, grouped so the grid reads as sections
 * rather than a wall. Material Symbols ligature names; the font is already
 * loaded for the rest of the app.
 */
export const HABIT_ICON_GROUPS: { label: string; icons: string[] }[] = [
  {
    label: 'Moving',
    icons: ['directions_walk', 'directions_run', 'hiking', 'directions_bike',
            'pool', 'rowing', 'fitness_center', 'sports_martial_arts', 'self_improvement'],
  },
  {
    label: 'Body',
    icons: ['favorite', 'monitor_heart', 'monitor_weight', 'bedtime',
            'water_drop', 'restaurant', 'medication', 'spa', 'no_drinks'],
  },
  {
    label: 'Life',
    icons: ['pets', 'menu_book', 'edit_note', 'piano', 'brush',
            'park', 'cleaning_services', 'savings', 'smoke_free'],
  },
  {
    label: 'Marks',
    icons: ['check_circle', 'star', 'bolt', 'flag', 'schedule',
            'sunny', 'local_cafe', 'forest', 'phone_iphone'],
  },
];

/** Every icon the picker offers, flattened. */
export const HABIT_ICONS: string[] = HABIT_ICON_GROUPS.flatMap(g => g.icons);

/**
 * The tracked habits, in display order.
 *
 * Seeded once with the five defaults, then owned by the user. The seeded flag
 * means deleting them all does not bring them back on the next load.
 */
export function loadHabits(): Habit[] {
  try {
    const raw = localStorage.getItem(HABIT_DEFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return (parsed as Habit[]).slice().sort((a, b) => a.order - b.order);
      }
    }
  } catch {
    // Fall through to the defaults rather than leaving the app with none.
  }

  if (localStorage.getItem(HABITS_SEEDED_KEY)) return [];
  localStorage.setItem(HABITS_SEEDED_KEY, 'true');
  saveHabits(DEFAULT_HABITS);
  return DEFAULT_HABITS.slice();
}

/** Writes the list, renumbering order so it always matches position. */
export function saveHabits(habits: Habit[]): void {
  const ordered = habits.map((h, i) => ({ ...h, order: i }));
  localStorage.setItem(HABIT_DEFS_KEY, JSON.stringify(ordered));
  localStorage.setItem(HABITS_SEEDED_KEY, 'true');
}

export function addHabit(input: { name: string; cadence: HabitCadence; heldByDefault: boolean; icon?: string }): Habit {
  const habits = loadHabits();
  const habit: Habit = { id: generateUUID(), order: habits.length, ...input };
  saveHabits([...habits, habit]);
  return habit;
}

export function updateHabit(id: string, patch: Partial<Omit<Habit, 'id'>>): Habit | null {
  const habits = loadHabits();
  const index = habits.findIndex(h => h.id === id);
  if (index === -1) return null;
  const updated = { ...habits[index], ...patch, id };
  habits[index] = updated;
  saveHabits(habits);
  return updated;
}

/** Removes a habit. Its logs are left alone; nothing reads them once it is gone. */
export function deleteHabit(id: string): void {
  saveHabits(loadHabits().filter(h => h.id !== id));
}

/** Moves a habit one place up or down. A no-op at either end. */
export function moveHabit(id: string, direction: -1 | 1): Habit[] {
  const habits = loadHabits();
  const from = habits.findIndex(h => h.id === id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= habits.length) return habits;
  [habits[from], habits[to]] = [habits[to], habits[from]];
  saveHabits(habits);
  return loadHabits();
}

/**
 * The habits that make up a day's completion score, and so the ring's
 * denominator. Adding a daily habit widens it; that is the point of scoring a
 * day as one number rather than encoding each habit in the shape.
 */
export function dailyHabits(): Habit[] {
  return loadHabits().filter(h => h.cadence.kind !== 'weekly');
}

/** The habits owed a number of times per week, on no particular day. */
export function weeklyHabits(): Habit[] {
  return loadHabits().filter(h => h.cadence.kind === 'weekly');
}

/** How a habit's cadence reads in the list, in plain words. */
/** The line under a habit's name in the list. */
export function describeCadence(cadence: HabitCadence, heldByDefault: boolean): string {
  const held = heldByDefault ? ', held unless you break it' : '';
  switch (cadence.kind) {
    case 'daily': return `Every day${held}`;
    case 'daily-quota': return `${cadence.perWeek} of 7 days${held}`;
    case 'weekly': return `${cadence.perWeek}× a week${held}`;
  }
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
