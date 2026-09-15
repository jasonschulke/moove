/**
 * Derived statistics over stored workout data.
 *
 * Read-only queries: streaks, the contribution map, per-exercise history,
 * usage rankings. Split out of storage.ts, which now owns persistence only.
 * Nothing here writes to localStorage.
 */

import type { ExerciseLog, WorkoutBlock, WorkoutSession } from '../types';
import { formatLocalDate, loadSessions, loadSkipCounts } from './storage';

/** Local midnight for a date string, as a timestamp. */
function startOfDay(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Whole calendar days between two midnight timestamps.
 * Rounded, so the 23 and 25 hour days either side of a DST change still
 * count as one day apart.
 */
function daysBetween(laterMs: number, earlierMs: number): number {
  return Math.round((laterMs - earlierMs) / 86400000);
}

// Last Workout
export function getLastWorkout(): { blocks: WorkoutBlock[]; completedAt: string } | null {
  const sessions = loadSessions().filter(s => s.completedAt && s.blocks?.length > 0);
  if (sessions.length === 0) return null;
  return {
    blocks: sessions[0].blocks,
    completedAt: sessions[0].completedAt!,
  };
}

export function getExerciseHistory(exerciseId: string, limit = 10): ExerciseLog[] {
  const sessions = loadSessions();
  const history: ExerciseLog[] = [];

  for (const session of sessions) {
    for (const log of session.exercises) {
      if (log.exerciseId === exerciseId) {
        history.push(log);
        if (history.length >= limit) return history;
      }
    }
  }

  return history;
}

export function getLastWeekAverages(exerciseId: string): { avgWeight: number; avgReps: number } | null {
  const sessions = loadSessions();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const recentLogs = sessions
    .filter(s => new Date(s.startedAt) >= oneWeekAgo)
    .flatMap(s => s.exercises)
    .filter(e => e.exerciseId === exerciseId);

  if (recentLogs.length === 0) return null;

  const weights = recentLogs.filter(l => l.weight).map(l => l.weight!);
  const reps = recentLogs.filter(l => typeof l.reps === 'number').map(l => l.reps as number);

  return {
    avgWeight: weights.length > 0 ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length) : 0,
    avgReps: reps.length > 0 ? Math.round(reps.reduce((a, b) => a + b, 0) / reps.length) : 0,
  };
}

// Get workout dates for the current week (for checkmark display)
export function getThisWeekWorkoutDates(): Set<string> {
  const sessions = loadSessions().filter(s => s.completedAt);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Start from Sunday
  startOfWeek.setHours(0, 0, 0, 0);

  const dates = new Set<string>();
  sessions.forEach(s => {
    const sessionDate = new Date(s.startedAt);
    if (sessionDate >= startOfWeek) {
      dates.add(sessionDate.toDateString());
    }
  });
  return dates;
}

/** Workout type info for calendar display */
export interface DayWorkoutInfo {
  count: number;
  hasCardio: boolean;
  hasStrength: boolean;
}

// Get yearly contribution data (GitHub-style grid)
export function getYearlyContributions(): Map<string, DayWorkoutInfo> {
  const sessions = loadSessions().filter(s => s.completedAt);
  const contributions = new Map<string, DayWorkoutInfo>();

  // Get dates for the last 365 days
  const now = new Date();
  for (let i = 364; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = formatLocalDate(date);
    contributions.set(dateStr, { count: 0, hasCardio: false, hasStrength: false });
  }

  // Count workouts per day and track type
  sessions.forEach(s => {
    const dateStr = formatLocalDate(new Date(s.startedAt));
    if (contributions.has(dateStr)) {
      const current = contributions.get(dateStr)!;
      current.count++;
      if (s.cardioType) {
        current.hasCardio = true;
      } else if (s.exercises.length > 0) {
        current.hasStrength = true;
      }
    }
  });

  return contributions;
}

export function getWorkoutStats(): {
  totalWorkouts: number;
  thisWeek: number;
  thisMonth: number;
  avgDuration: number;
  longestStreak: number;
  currentStreak: number;
  workoutsByDay: Record<number, number>;
} {
  const sessions = loadSessions().filter(s => s.completedAt);

  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const thisWeek = sessions.filter(s => new Date(s.startedAt) >= oneWeekAgo).length;
  const thisMonth = sessions.filter(s => new Date(s.startedAt) >= oneMonthAgo).length;

  const durations = sessions
    .filter(s => s.totalDuration)
    .map(s => s.totalDuration!);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Streaks, counted in calendar days.
  //
  // Two bugs previously lived here. tempStreak was only seeded when the most
  // recent workout was today or yesterday, so longestStreak was short by one
  // for any history that ended earlier. And currentStreak was reassigned on
  // every contiguous pair anywhere in the list, so a long run from months ago
  // could overwrite the real current streak once it had been broken.
  const dayStamps = [...new Set(sessions.map(s => startOfDay(s.startedAt)))]
    .sort((a, b) => b - a);

  let longestStreak = 0;
  let run = 0;
  for (let i = 0; i < dayStamps.length; i++) {
    run = (i === 0 || daysBetween(dayStamps[i - 1], dayStamps[i]) === 1) ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }

  let currentStreak = 0;
  if (dayStamps.length > 0) {
    const gapToLatest = daysBetween(startOfDay(now.toISOString()), dayStamps[0]);
    // A streak is still live if the last workout was today or yesterday.
    if (gapToLatest === 0 || gapToLatest === 1) {
      currentStreak = 1;
      for (let i = 1; i < dayStamps.length; i++) {
        if (daysBetween(dayStamps[i - 1], dayStamps[i]) !== 1) break;
        currentStreak++;
      }
    }
  }

  // Workouts by day of week (0 = Sunday)
  const workoutsByDay: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  sessions.forEach(s => {
    const day = new Date(s.startedAt).getDay();
    workoutsByDay[day]++;
  });

  return {
    totalWorkouts: sessions.length,
    thisWeek,
    thisMonth,
    avgDuration,
    longestStreak,
    currentStreak,
    workoutsByDay,
  };
}

// ============================================================================
// REST DAYS
// ============================================================================

// Get effort data over time for chart
export function getEffortHistory(limit = 20): { date: string; effort: number }[] {
  const sessions = loadSessions()
    .filter(s => s.completedAt && s.overallEffort)
    .slice(0, limit)
    .reverse();

  return sessions.map(s => ({
    date: new Date(s.completedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    effort: s.overallEffort!,
  }));
}

export function getMostSkippedExercises(limit = 5): { exerciseId: string; skips: number; swaps: number }[] {
  const counts = loadSkipCounts();
  return Object.entries(counts)
    .map(([exerciseId, data]) => ({ exerciseId, ...data }))
    .sort((a, b) => (b.skips + b.swaps) - (a.skips + a.swaps))
    .slice(0, limit);
}

// Get workout sessions for a specific date
export function getSessionsByDate(dateStr: string): WorkoutSession[] {
  const sessions = loadSessions().filter(s => s.completedAt);
  return sessions.filter(s => {
    const sessionDate = formatLocalDate(new Date(s.startedAt));
    return sessionDate === dateStr;
  });
}

// Get most used workouts based on frequency
export function getMostUsedWorkouts(limit = 10): { workoutName: string; count: number; lastUsed: string }[] {
  const sessions = loadSessions().filter(s => s.completedAt && s.name);
  const counts = new Map<string, { count: number; lastUsed: string }>();

  sessions.forEach(s => {
    const existing = counts.get(s.name) || { count: 0, lastUsed: '' };
    existing.count++;
    if (!existing.lastUsed || new Date(s.completedAt!) > new Date(existing.lastUsed)) {
      existing.lastUsed = s.completedAt!;
    }
    counts.set(s.name, existing);
  });

  return Array.from(counts.entries())
    .map(([workoutName, data]) => ({ workoutName, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Get most used exercises based on frequency
export function getMostUsedExercises(limit = 10): { exerciseId: string; count: number; lastUsed: string }[] {
  const sessions = loadSessions().filter(s => s.completedAt);
  const counts = new Map<string, { count: number; lastUsed: string }>();

  sessions.forEach(s => {
    s.exercises.forEach(ex => {
      const existing = counts.get(ex.exerciseId) || { count: 0, lastUsed: '' };
      existing.count++;
      if (!existing.lastUsed || new Date(ex.completedAt) > new Date(existing.lastUsed)) {
        existing.lastUsed = ex.completedAt;
      }
      counts.set(ex.exerciseId, existing);
    });
  });

  return Array.from(counts.entries())
    .map(([exerciseId, data]) => ({ exerciseId, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ============================================================================
// CUSTOM DESCRIPTIONS
// ============================================================================
