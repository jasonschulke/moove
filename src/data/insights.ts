/**
 * The broader cadence: what the week and the month actually looked like.
 *
 * Today answers "what now". This answers "how has it been going", which is the
 * question that earns a weekly or monthly glance rather than a daily one.
 * Pure functions over a date and a log map, same as today.ts.
 */

import type { Habit, HabitLogMap } from '../types/habits';
import { habitsOn, countDoneInWeek, loadHabitLogs, dayScore, earliestMeasuredDate } from './habits';
import { startOfWeek, endOfWeek } from '../utils/week';
import { formatLocalDate, isRestDay, loadRestDays } from './storage';
import type { Situation } from './voice';

export interface HabitBar {
  habit: Habit;
  done: number;
  /** Days in the week the habit is expected. 7 for a plain daily habit. */
  target: number;
}

export interface WeekReview {
  /** "8–14 September", or "29 September – 5 October" across a month boundary. */
  rangeLabel: string;
  /** How the week went, as a situation. The wording comes from voice.ts. */
  situation: Situation;
  /** The habit the verdict is about, when there is one. */
  worstHabit: string | null;
  bars: HabitBar[];
  /** Days in the week that closed completely. */
  daysClosed: number;
  daysCounted: number;
}

export interface DayCompletion {
  dateStr: string;
  dayOfMonth: number;
  /** 0 to 1, from dayScore: daily habits plus any weekly one done that day. */
  completion: number;
  isRest: boolean;
  isToday: boolean;
  /** Days that have not happened yet are drawn empty rather than as failures. */
  isFuture: boolean;
  /**
   * Before tracking began. The dry day is held by default, which would
   * otherwise score every day back to January at a third and wash the year
   * grid in pale green. Untracked days are drawn empty and scored zero.
   */
  isUntracked: boolean;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** How many days in the week a habit is expected. */
function weekTarget(habit: Habit): number {
  switch (habit.cadence.kind) {
    case 'daily': return 7;
    case 'daily-quota': return habit.cadence.perWeek;
    case 'weekly': return habit.cadence.perWeek;
  }
}

/**
 * The first day anything was logged, or null if nothing ever was. Everything
 * before it is history the app knows nothing about.
 */
export function trackingStartedOn(logs: HabitLogMap): string | null {
  const dates = Object.keys(logs).filter(d => Object.keys(logs[d] ?? {}).length > 0);
  const fromLog = dates.length === 0 ? null : dates.sort()[0];
  // Weight does not live in the habit log, so a day on which the only thing
  // you did was weigh yourself would otherwise read as before tracking began.
  const fromMeasured = earliestMeasuredDate();
  if (fromLog === null) return fromMeasured;
  if (fromMeasured === null) return fromLog;
  return fromLog < fromMeasured ? fromLog : fromMeasured;
}

/** The share of a day that was closed. */
export function dayCompletion(dateStr: string, logs: HabitLogMap): number {
  const { completed, total } = dayScore(dateStr, logs);
  return total === 0 ? 0 : completed / total;
}

export function formatWeekRange(date: Date): string {
  const start = startOfWeek(date);
  const end = new Date(endOfWeek(date));
  end.setDate(end.getDate() - 1); // inclusive Sunday

  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]}`
    : `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
}

/**
 * How the week went, and which habit the verdict should name. A percentage
 * cannot say which thing keeps slipping, so the worst miss is called out by
 * name; the wording of the sentence itself lives in voice.ts.
 */
export function weekVerdict(
  daysCounted: number,
  bars: HabitBar[],
): { situation: Situation; worstHabit: string | null } {
  if (daysCounted === 0) return { situation: 'weekNotStarted', worstHabit: null };

  const missed = bars
    .filter(b => b.done < b.target)
    .sort((a, b) => (a.done / a.target) - (b.done / b.target));

  if (missed.length === 0) return { situation: 'weekPerfect', worstHabit: null };
  return {
    situation: missed[0].done === 0 ? 'weekZero' : 'weekGap',
    worstHabit: missed[0].habit.name,
  };
}

export function getWeekReview(now: Date = new Date(), logs?: HabitLogMap): WeekReview {
  const log = logs ?? loadHabitLogs();
  const todayStr = formatLocalDate(now);

  // Only days that have happened can be judged. The same walk collects which
  // habits were being tracked during the week, so one dropped on Wednesday
  // still gets a bar for the days it was part of.
  let daysClosed = 0;
  let daysCounted = 0;
  const tracked = new Map<string, Habit>();
  const end = endOfWeek(now);
  for (const d = new Date(startOfWeek(now)); d < end; d.setDate(d.getDate() + 1)) {
    const dateStr = formatLocalDate(d);
    if (dateStr > todayStr) break;
    daysCounted++;
    if (dayCompletion(dateStr, log) === 1) daysClosed++;
    for (const habit of habitsOn(dateStr)) tracked.set(habit.id, habit);
  }
  // A week that has not started yet still lists what you are tracking now.
  if (tracked.size === 0) for (const habit of habitsOn(todayStr)) tracked.set(habit.id, habit);

  const bars: HabitBar[] = [...tracked.values()]
    .sort((a, b) => a.order - b.order)
    .map(habit => ({
      habit,
      done: Math.min(countDoneInWeek(habit, now, log), weekTarget(habit)),
      target: weekTarget(habit),
    }));

  const { situation, worstHabit } = weekVerdict(daysCounted, bars);

  return {
    rangeLabel: formatWeekRange(now),
    situation,
    worstHabit,
    bars,
    daysClosed,
    daysCounted,
  };
}

/**
 * Monday to Sunday of the containing week, for the strip on Today. Same shape
 * as the month, so the two read as the same thing at different zooms.
 */
export function getWeekDays(now: Date = new Date(), logs?: HabitLogMap): DayCompletion[] {
  const log = logs ?? loadHabitLogs();
  const todayStr = formatLocalDate(now);
  const started = trackingStartedOn(log);
  const out: DayCompletion[] = [];

  const end = endOfWeek(now);
  for (const d = new Date(startOfWeek(now)); d < end; d.setDate(d.getDate() + 1)) {
    const dateStr = formatLocalDate(d);
    const isFuture = dateStr > todayStr;
    const isUntracked = started === null || dateStr < started;
    out.push({
      dateStr,
      dayOfMonth: d.getDate(),
      completion: isFuture || isUntracked ? 0 : dayCompletion(dateStr, log),
      isRest: isRestDay(dateStr),
      isToday: dateStr === todayStr,
      isFuture,
      isUntracked,
    });
  }
  return out;
}

/** Every day of the containing calendar month, in order. */
export function getMonthCompletion(now: Date = new Date(), logs?: HabitLogMap): DayCompletion[] {
  const log = logs ?? loadHabitLogs();
  const todayStr = formatLocalDate(now);
  const started = trackingStartedOn(log);
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();

  const out: DayCompletion[] = [];
  for (let day = 1; day <= days; day++) {
    const dateStr = formatLocalDate(new Date(year, month, day));
    const isFuture = dateStr > todayStr;
    const isUntracked = started === null || dateStr < started;
    out.push({
      dateStr,
      dayOfMonth: day,
      completion: isFuture || isUntracked ? 0 : dayCompletion(dateStr, log),
      isRest: isRestDay(dateStr),
      isToday: dateStr === todayStr,
      isFuture,
      isUntracked,
    });
  }
  return out;
}

/** Days since 1 January, for the year grid. */
export function getYearCompletion(now: Date = new Date(), logs?: HabitLogMap): DayCompletion[] {
  const log = logs ?? loadHabitLogs();
  const todayStr = formatLocalDate(now);
  const started = trackingStartedOn(log);
  const rest = loadRestDays();
  const out: DayCompletion[] = [];

  const d = new Date(now.getFullYear(), 0, 1);
  while (d.getFullYear() === now.getFullYear()) {
    const dateStr = formatLocalDate(d);
    const isFuture = dateStr > todayStr;
    const isUntracked = started === null || dateStr < started;
    out.push({
      dateStr,
      dayOfMonth: d.getDate(),
      completion: isFuture || isUntracked ? 0 : dayCompletion(dateStr, log),
      isRest: rest.has(dateStr),
      isToday: dateStr === todayStr,
      isFuture,
      isUntracked,
    });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** The label under the month grid. */
export function monthLabel(now: Date = new Date()): string {
  return MONTHS[now.getMonth()];
}
