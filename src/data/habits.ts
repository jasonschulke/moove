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
import { formatLocalDate, loadBodyMetrics, recordWeight, removeWeight, BODY_METRICS_KEY } from './storage';
import { generateUUID } from '../utils/uuid';

const HABIT_LOGS_KEY = 'habit_logs';
const HABIT_DEFS_KEY = 'habit_definitions';
const HABITS_SEEDED_KEY = 'habit_definitions_seeded';
const HELD_MIGRATED_KEY = 'habit_held_default_off';

/** What a new install starts with. Editable from Library once it is seeded. */
export const DEFAULT_HABITS: Habit[] = [
  { id: 'walk', name: 'Walk',         cadence: { kind: 'daily' },                   heldByDefault: false, icon: 'directions_walk', color: 'green',  order: 0 },
  { id: 'dog',  name: 'Walk the dog', cadence: { kind: 'daily' },                   heldByDefault: false, icon: 'pets',            color: 'amber',  order: 1 },
  { id: 'dry',  name: 'Dry day',      cadence: { kind: 'daily-quota', perWeek: 5 }, heldByDefault: false, icon: 'no_drinks',       color: 'plum',   order: 2 },
  { id: 'lift', name: 'Lift',         cadence: { kind: 'weekly', perWeek: 3 },      heldByDefault: false, icon: 'fitness_center',  color: 'rust',   order: 3 },
  { id: 'run',  name: 'Run',          cadence: { kind: 'weekly', perWeek: 1 },      heldByDefault: false, icon: 'directions_run',  color: 'indigo', order: 4 },
  { id: 'weight', name: 'Weight',     cadence: { kind: 'daily' },                   heldByDefault: false, icon: 'monitor_weight',  color: 'rose',   unit: 'lb', source: 'bodyWeight', order: 5 },
];

/**
 * The colours a habit can take. Deliberately muted: these sit on warm paper
 * next to each other in a list, so anything saturated shouts. Each is dark
 * enough to read as an icon and as a bar on white.
 *
 * The ring is not among the places colour goes. A segment per habit would put
 * the habit count back into the shape of the donut, which is the thing a
 * single completion score was chosen to avoid.
 */
export const HABIT_COLORS: { key: string; label: string; value: string }[] = [
  { key: 'green',  label: 'Green',  value: '#047857' },
  { key: 'teal',   label: 'Teal',   value: '#0f766e' },
  { key: 'blue',   label: 'Blue',   value: '#1d4ed8' },
  { key: 'indigo', label: 'Indigo', value: '#4338ca' },
  { key: 'plum',   label: 'Plum',   value: '#7c3aed' },
  { key: 'rose',   label: 'Rose',   value: '#be123c' },
  { key: 'rust',   label: 'Rust',   value: '#c2410c' },
  { key: 'amber',  label: 'Amber',  value: '#b45309' },
];

/** The CSS colour for a habit, falling back to the app's green. */
export function habitColor(habit: { color?: string }): string {
  return HABIT_COLORS.find(c => c.key === habit.color)?.value ?? 'var(--mv-green)';
}

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

/**
 * The units offered as chips in the editor. Typing something else is fine;
 * these are the ones worth not making someone type on a phone.
 */
export const HABIT_UNITS = ['lb', 'kg', 'oz', 'cups', 'min', 'hr', 'steps', 'cal', 'pages', 'mi'];

/** Every icon the picker offers, flattened. */
export const HABIT_ICONS: string[] = HABIT_ICON_GROUPS.flatMap(g => g.icons);

/**
 * The tracked habits, in display order.
 *
 * Seeded once with the five defaults, then owned by the user. The seeded flag
 * means deleting them all does not bring them back on the next load.
 */
let habitCache: { raw: string | null; habits: Habit[] } | null = null;

export function loadHabits(): Habit[] {
  try {
    const raw = localStorage.getItem(HABIT_DEFS_KEY);
    if (raw) {
      // The year grid asks about 365 days and every day asks about every
      // habit, so parsing this on each question is thousands of parses for one
      // screen. The raw string is the cache key, which means any write through
      // saveHabits invalidates it without anyone having to remember to.
      if (habitCache && habitCache.raw === raw) return habitCache.habits.slice();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const habits = migrateHeldDefault((parsed as Habit[]).slice().sort((a, b) => a.order - b.order));
        habitCache = { raw, habits };
        return habits.slice();
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

/**
 * A habit that starts each day already ticked made the ring read 1 of 3 before
 * anything had happened, which is not what "done" should mean. The flag stays
 * available in the editor for anyone who wants the Streaks behaviour, but it
 * is off by default, and this turns it off once on lists that predate that.
 */
function migrateHeldDefault(habits: Habit[]): Habit[] {
  if (localStorage.getItem(HELD_MIGRATED_KEY)) return habits;
  localStorage.setItem(HELD_MIGRATED_KEY, 'true');
  if (!habits.some(h => h.heldByDefault)) return habits;
  const next = habits.map(h => (h.heldByDefault ? { ...h, heldByDefault: false } : h));
  localStorage.setItem(HABIT_DEFS_KEY, JSON.stringify(next));
  return next;
}

/** Writes the list, renumbering order so it always matches position. */
export function saveHabits(habits: Habit[]): void {
  const ordered = habits.map((h, i) => ({ ...h, order: i }));
  localStorage.setItem(HABIT_DEFS_KEY, JSON.stringify(ordered));
  localStorage.setItem(HABITS_SEEDED_KEY, 'true');
}

export function addHabit(input: {
  name: string; cadence: HabitCadence; heldByDefault: boolean;
  icon?: string; color?: string; unit?: string; source?: 'bodyWeight';
  target?: number; targetDirection?: 'atLeast' | 'atMost';
}): Habit {
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

/** What a measured habit is asking for, in plain words. Null if it is a tick. */
export function describeMeasure(habit: Habit): string | null {
  if (!habit.unit) return null;
  if (habit.target === undefined) return `Records a number in ${habit.unit}`;
  const side = habit.targetDirection === 'atMost' ? 'at most' : 'at least';
  return `Counts ${side} ${habit.target} ${habit.unit}`;
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
 * Body weight by date. Same trick as the habit cache above: the year grid
 * would otherwise parse this list once per day drawn.
 */
let weightCache: { raw: string | null; byDate: Map<string, number> } | null = null;

function weightByDate(): Map<string, number> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(BODY_METRICS_KEY);
  } catch {
    return new Map();
  }
  if (weightCache && weightCache.raw === raw) return weightCache.byDate;
  const byDate = new Map<string, number>();
  for (const m of loadBodyMetrics()) {
    if (typeof m.weight === 'number') byDate.set(m.date, m.weight);
  }
  weightCache = { raw, byDate };
  return byDate;
}

/**
 * Whether a habit counts as done on a date. An absent entry means the habit's
 * default, which is true only for inverted habits like the dry day.
 */
export function isHabitDone(habit: Habit, dateStr: string, logs: HabitLogMap): boolean {
  if (habit.unit) {
    const value = habitValue(habit, dateStr, logs);
    return value !== null && meetsTarget(habit, value);
  }
  const explicit = logs[dateStr]?.[habit.id];
  if (explicit === undefined) return habit.heldByDefault;
  // A number in the log still counts, so removing a unit does not unpick history.
  return typeof explicit === 'number' ? true : explicit;
}

/**
 * Whether a reading is good enough. No target means any reading counts, which
 * is right for something you are watching rather than chasing.
 */
export function meetsTarget(habit: Habit, value: number): boolean {
  if (habit.target === undefined) return true;
  return habit.targetDirection === 'atMost' ? value <= habit.target : value >= habit.target;
}

/** The number logged for a measured habit on a date, if there is one. */
export function habitValue(habit: Habit, dateStr: string, logs: HabitLogMap): number | null {
  if (!habit.unit) return null;
  if (habit.source === 'bodyWeight') return weightByDate().get(dateStr) ?? null;
  const entry = logs[dateStr]?.[habit.id];
  return typeof entry === 'number' ? entry : null;
}

/** Every reading a measured habit has, oldest first. What the chart draws. */
export function habitSeries(habit: Habit, logs: HabitLogMap): { date: string; value: number }[] {
  if (!habit.unit) return [];
  const points = habit.source === 'bodyWeight'
    ? [...weightByDate().entries()].map(([date, value]) => ({ date, value }))
    : Object.entries(logs).flatMap(([date, entry]) => {
        const value = entry?.[habit.id];
        return typeof value === 'number' ? [{ date, value }] : [];
      });
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** The habits that record a number rather than a tick. */
export function measuredHabits(): Habit[] {
  return loadHabits().filter(h => h.unit);
}

/** Write one habit's state for one date. Returns the updated map. */
export function setHabitDone(habitId: string, dateStr: string, done: boolean | number): HabitLogMap {
  const habit = loadHabits().find(h => h.id === habitId);

  if (habit?.unit && habit.source === 'bodyWeight') {
    // The number is the record. Ticking one of these without a reading is not
    // a thing you can do, so only clearing goes through here.
    if (typeof done === 'number') recordWeight(done, dateStr);
    else if (done === false) removeWeight(dateStr);
    return loadHabitLogs();
  }

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
 * Record a number against a measured habit, which also marks it done.
 * Rejects anything that is not a sane reading, because one bad point is
 * permanent in a chart.
 */
export function recordHabitValue(habitId: string, dateStr: string, value: number): HabitLogMap | null {
  if (!Number.isFinite(value) || value <= 0 || value > 100000) return null;
  return setHabitDone(habitId, dateStr, Math.round(value * 10) / 10);
}

/**
 * The earliest date a measured habit was logged by hand, outside the habit log.
 *
 * Only by hand. A Health import can carry years of weigh-ins, and treating
 * those as the day tracking began would fill the year grid with months scored
 * near zero for habits that did not exist yet. An import is history; a reading
 * you entered yourself is tracking.
 */
export function earliestMeasuredDate(): string | null {
  if (!loadHabits().some(h => h.source === 'bodyWeight')) return null;
  const dates = loadBodyMetrics()
    .filter(m => typeof m.weight === 'number' && m.source === 'manual')
    .map(m => m.date)
    .sort();
  return dates[0] ?? null;
}

/**
 * The day's score, as a fraction.
 *
 * Daily habits are the base. A weekly habit joins both halves on the days it
 * is actually done: lift today and the day reads 4 of 4 rather than 3 of 3,
 * skip it and it is 3 of 3 again. So a weekly habit can only ever add to a
 * day, never dilute it, which is right because its cadence is the week. The
 * alternative, a fixed slot every day, would mark four days a week failed for
 * a habit you are meeting in full.
 */
export function dayScore(dateStr: string, logs: HabitLogMap): { completed: number; total: number } {
  const habits = loadHabits();
  const daily = habits.filter(h => h.cadence.kind !== 'weekly');
  const weeklyDone = habits.filter(
    h => h.cadence.kind === 'weekly' && isHabitDone(h, dateStr, logs)).length;
  return {
    completed: daily.filter(h => isHabitDone(h, dateStr, logs)).length + weeklyDone,
    total: daily.length + weeklyDone,
  };
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
