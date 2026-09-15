import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { WorkoutSession } from '../types';
import { saveSessions } from './storage';
import { getWorkoutStats, getYearlyContributions } from './stats';

/** Midnight-anchored ISO string for a day `daysAgo` before today. */
function dayOffset(daysAgo: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function session(daysAgo: number, overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  const at = dayOffset(daysAgo);
  return {
    id: `s-${daysAgo}-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Workout',
    blocks: [],
    startedAt: at,
    completedAt: at,
    exercises: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('getWorkoutStats', () => {
  it('counts nothing when there is no history', () => {
    const stats = getWorkoutStats();
    expect(stats.totalWorkouts).toBe(0);
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(0);
    expect(stats.avgDuration).toBe(0);
  });

  it('ignores sessions that were never completed', () => {
    saveSessions([
      session(0),
      session(1, { completedAt: undefined }),
    ]);
    expect(getWorkoutStats().totalWorkouts).toBe(1);
  });

  it('counts the calendar week and a rolling month', () => {
    // Pinned to Thursday 17 September 2026 so the assertion does not depend on
    // what day of the week the suite happens to run. That week is Mon 14 to
    // Sun 20, so today and three days ago are both inside it.
    vi.setSystemTime(new Date(2026, 8, 17, 12, 0, 0));
    try {
      saveSessions([session(0), session(3), session(10), session(60)]);
      const stats = getWorkoutStats();
      expect(stats.totalWorkouts).toBe(4);
      expect(stats.thisWeek).toBe(2);
      expect(stats.thisMonth).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('averages duration over sessions that recorded one', () => {
    saveSessions([
      session(0, { totalDuration: 600 }),
      session(1, { totalDuration: 1200 }),
      session(2),
    ]);
    expect(getWorkoutStats().avgDuration).toBe(900);
  });

  it('counts consecutive days ending today as the current streak', () => {
    saveSessions([session(0), session(1), session(2)]);
    const stats = getWorkoutStats();
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });

  it('still counts a streak that ended yesterday', () => {
    saveSessions([session(1), session(2)]);
    expect(getWorkoutStats().currentStreak).toBe(2);
  });

  it('reports no current streak when the last workout is older than yesterday', () => {
    saveSessions([session(4), session(5), session(6)]);
    const stats = getWorkoutStats();
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(3);
  });

  it('treats two workouts on one day as a single streak day', () => {
    saveSessions([session(0), session(0), session(1)]);
    const stats = getWorkoutStats();
    expect(stats.totalWorkouts).toBe(3);
    expect(stats.currentStreak).toBe(2);
  });

  it('does not let an older streak leak into the current one', () => {
    // Two days now, a gap, then a longer run a month ago. The current streak
    // is 2; the longest is 5.
    saveSessions([
      session(0), session(1),
      session(30), session(31), session(32), session(33), session(34),
    ]);
    const stats = getWorkoutStats();
    expect(stats.currentStreak).toBe(2);
    expect(stats.longestStreak).toBe(5);
  });

  it('buckets workouts by day of week', () => {
    saveSessions([session(0), session(7), session(1)]);
    const stats = getWorkoutStats();
    const todayDow = new Date().getDay();
    expect(stats.workoutsByDay[todayDow]).toBe(2);
  });
});

describe('getYearlyContributions', () => {
  it('covers a 365 day window', () => {
    expect(getYearlyContributions().size).toBe(365);
  });

  it('counts multiple sessions on the same day', () => {
    saveSessions([session(2), session(2), session(5)]);
    const map = getYearlyContributions();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const key = [
      twoDaysAgo.getFullYear(),
      String(twoDaysAgo.getMonth() + 1).padStart(2, '0'),
      String(twoDaysAgo.getDate()).padStart(2, '0'),
    ].join('-');
    expect(map.get(key)?.count).toBe(2);
  });

  it('distinguishes cardio from strength days', () => {
    saveSessions([
      session(1, { cardioType: 'run', distance: 3 }),
      session(2, {
        exercises: [{ exerciseId: 'pushups', reps: 10, completedAt: dayOffset(2) }],
      }),
    ]);
    const map = getYearlyContributions();
    const entries = [...map.values()].filter(v => v.count > 0);
    expect(entries.some(e => e.hasCardio && !e.hasStrength)).toBe(true);
    expect(entries.some(e => e.hasStrength && !e.hasCardio)).toBe(true);
  });

  it('leaves days without workouts empty rather than absent', () => {
    saveSessions([session(1)]);
    const map = getYearlyContributions();
    const zeroDays = [...map.values()].filter(v => v.count === 0);
    expect(zeroDays.length).toBe(364);
  });
});

describe('getWorkoutStats thisWeek', () => {
  // setSystemTime alone mocks only Date, not the timer queue, which is what
  // we want here. Restored after each test so the relative-date helpers in
  // the rest of this file keep working.
  afterEach(() => { vi.useRealTimers(); });

  it('counts from Monday, not a rolling seven days', () => {
    vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0)); // Tuesday; week is Mon 14 to Sun 20

    const onDay = (id: string, day: number): WorkoutSession => ({
      id,
      name: id,
      blocks: [],
      exercises: [],
      startedAt: new Date(2026, 8, day, 10, 0, 0).toISOString(),
      completedAt: new Date(2026, 8, day, 11, 0, 0).toISOString(),
    });

    saveSessions([
      onDay('a', 13), // Sunday, last week: inside a rolling 7 days, outside this week
      onDay('b', 14), // Monday, this week
      onDay('c', 15), // today
    ]);

    expect(getWorkoutStats().thisWeek).toBe(2);
  });
});
