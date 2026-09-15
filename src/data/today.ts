/**
 * What today looks like.
 *
 * Every judgement Today makes is here, as pure functions over a date and a log
 * map, so it can be tested without a browser. The page renders what this
 * returns and decides nothing.
 */

import type { Habit, HabitLogMap } from '../types/habits';
import { loadHabits, dailyHabits, weeklyHabits, isHabitDone, countDoneInWeek, loadHabitLogs } from './habits';
import { daysLeftInWeek } from '../utils/week';
import { formatLocalDate, isRestDay } from './storage';

export interface HabitStatus {
  habit: Habit;
  /** Done today. */
  done: boolean;
  /** Times still owed this week. Zero for habits with no weekly quota. */
  owed: number;
  /** The weekly target, or 0 for a plain daily habit. */
  perWeek: number;
  doneThisWeek: number;
}

export interface Suggestion {
  habit: Habit;
  /**
   * Why this one. Load-bearing: without it the suggestion is arbitrary and
   * gets overridden every time.
   */
  reason: string;
}

export interface TodayView {
  dateStr: string;
  dayOfMonth: number;
  isRest: boolean;
  /** Daily habits done today. */
  completed: number;
  /** Always 3. Daily habits only, so the denominator never moves. */
  total: number;
  statuses: HabitStatus[];
  suggestion: Suggestion | null;
}

/** The line under the suggestion. Three shapes, no more. */
export function suggestionReason(owed: number, daysLeft: number): string {
  if (daysLeft <= 1) return 'Last day of the week';
  if (owed >= daysLeft) return 'Every remaining day';
  return `${owed} left, ${daysLeft} days`;
}

function weeklyTarget(habit: Habit): number {
  return habit.cadence.kind === 'weekly' ? habit.cadence.perWeek : 0;
}

export function getTodayView(now: Date = new Date(), logs?: HabitLogMap): TodayView {
  const log = logs ?? loadHabitLogs();
  const dateStr = formatLocalDate(now);
  const daysLeft = daysLeftInWeek(now);

  const statuses: HabitStatus[] = loadHabits().map(habit => {
    const doneThisWeek = countDoneInWeek(habit, now, log);
    const perWeek = weeklyTarget(habit);
    return {
      habit,
      done: isHabitDone(habit, dateStr, log),
      perWeek,
      doneThisWeek,
      owed: Math.max(0, perWeek - doneThisWeek),
    };
  });

  const daily = dailyHabits();
  const completed = daily.filter(h => isHabitDone(h, dateStr, log)).length;
  const isRest = isRestDay(dateStr);

  return {
    dateStr,
    dayOfMonth: now.getDate(),
    isRest,
    completed,
    total: daily.length,
    statuses,
    // A rest day is a decision already made. Suggesting work would undo it.
    suggestion: isRest ? null : pickSuggestion(statuses, daysLeft),
  };
}

/**
 * The weekly habit under the most pressure, measured as debt per remaining
 * day. Falls back to the first undone daily habit, then to nothing.
 */
function pickSuggestion(statuses: HabitStatus[], daysLeft: number): Suggestion | null {
  const weeklyIds = new Set(weeklyHabits().map(h => h.id));
  const owing = statuses
    .filter(s => weeklyIds.has(s.habit.id) && s.owed > 0)
    .sort((a, b) => (b.owed / daysLeft) - (a.owed / daysLeft) || a.habit.order - b.habit.order);

  if (owing.length > 0) {
    return { habit: owing[0].habit, reason: suggestionReason(owing[0].owed, daysLeft) };
  }

  const dailyIds = new Set(dailyHabits().map(h => h.id));
  const openDaily = statuses.find(s => dailyIds.has(s.habit.id) && !s.done);
  if (openDaily) return { habit: openDaily.habit, reason: 'Still open today' };

  return null;
}
