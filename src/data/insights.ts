/**
 * The broader cadence: what the week and the month actually looked like.
 *
 * Today answers "what now". This answers "how has it been going", which is the
 * question that earns a weekly or monthly glance rather than a daily one.
 * Pure functions over a date and a log map, same as today.ts.
 */

import type { Habit, HabitLogMap } from '../types/habits';
import { HABITS, dailyHabits, isHabitDone, countDoneInWeek, loadHabitLogs } from './habits';
import { startOfWeek, endOfWeek } from '../utils/week';
import { formatLocalDate, isRestDay, loadRestDays } from './storage';

export interface HabitBar {
  habit: Habit;
  done: number;
  /** Days in the week the habit is expected. 7 for a plain daily habit. */
  target: number;
}

export interface WeekReview {
  /** "8–14 September", or "29 September – 5 October" across a month boundary. */
  rangeLabel: string;
  /** One sentence. The only serif on the screen. */
  verdict: string;
  bars: HabitBar[];
  /** Days in the week that closed completely. */
  daysClosed: number;
  daysCounted: number;
}

export interface DayCompletion {
  dateStr: string;
  dayOfMonth: number;
  /** 0 to 1. Daily habits only, so the denominator is the same every day. */
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
  return dates.length === 0 ? null : dates.sort()[0];
}

/** The share of a day's daily habits that were done. */
export function dayCompletion(dateStr: string, logs: HabitLogMap): number {
  const daily = dailyHabits();
  if (daily.length === 0) return 0;
  return daily.filter(h => isHabitDone(h, dateStr, logs)).length / daily.length;
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
 * The verdict line. States what happened, then names the single worst miss,
 * because a percentage cannot say which thing keeps slipping.
 */
export function weekVerdict(daysClosed: number, daysCounted: number, bars: HabitBar[]): string {
  const missed = bars
    .filter(b => b.done < b.target)
    .sort((a, b) => (a.done / a.target) - (b.done / b.target));

  if (daysCounted === 0) return 'The week has not started.';

  const closed = daysClosed === daysCounted
    ? `All ${daysCounted} closed.`
    : `${daysClosed} of ${daysCounted} closed.`;

  if (missed.length === 0) return `${closed} Nothing owed.`;
  if (missed[0].done === 0) return `${closed} No ${missed[0].habit.name.toLowerCase()} yet.`;
  return `${closed} ${missed[0].habit.name} is the gap.`;
}

export function getWeekReview(now: Date = new Date(), logs?: HabitLogMap): WeekReview {
  const log = logs ?? loadHabitLogs();
  const todayStr = formatLocalDate(now);

  const bars: HabitBar[] = HABITS.map(habit => ({
    habit,
    done: Math.min(countDoneInWeek(habit, now, log), weekTarget(habit)),
    target: weekTarget(habit),
  }));

  // Only days that have happened can be judged.
  let daysClosed = 0;
  let daysCounted = 0;
  const end = endOfWeek(now);
  for (const d = new Date(startOfWeek(now)); d < end; d.setDate(d.getDate() + 1)) {
    const dateStr = formatLocalDate(d);
    if (dateStr > todayStr) break;
    daysCounted++;
    if (dayCompletion(dateStr, log) === 1) daysClosed++;
  }

  return {
    rangeLabel: formatWeekRange(now),
    verdict: weekVerdict(daysClosed, daysCounted, bars),
    bars,
    daysClosed,
    daysCounted,
  };
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
