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
import type { Situation } from './voice';

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
   * Why this one, as a situation rather than a sentence. Load-bearing:
   * without a reason the suggestion is arbitrary and gets overridden every
   * time. The wording comes from voice.ts so it can carry the user's tone.
   */
  situation: Situation;
  /** Times still owed, for the line to quote. */
  owed: number;
  /** Days from today through Sunday, for the line to quote. */
  daysLeft: number;
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
  /** How the day is going, for the line beside the ring. */
  daySituation: Situation;
}

/** How much pressure a weekly debt is under. Three shapes, no more. */
export function debtSituation(owed: number, daysLeft: number): Situation {
  if (daysLeft <= 1) return 'debtLastDay';
  if (owed >= daysLeft) return 'debtTight';
  return 'debtComfortable';
}

/** How the day is going, for the line beside the ring. */
export function daySituation(completed: number, total: number, isRest: boolean): Situation {
  if (isRest) return 'dayRest';
  if (completed === 0) return 'dayEmpty';
  if (completed >= total) return 'dayClosed';
  return 'dayPartial';
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
    daySituation: daySituation(completed, daily.length, isRest),
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
    const { habit, owed } = owing[0];
    return { habit, situation: debtSituation(owed, daysLeft), owed, daysLeft };
  }

  const dailyIds = new Set(dailyHabits().map(h => h.id));
  const openDaily = statuses.find(s => dailyIds.has(s.habit.id) && !s.done);
  if (openDaily) return { habit: openDaily.habit, situation: 'dailyOpen', owed: 0, daysLeft };

  return null;
}
