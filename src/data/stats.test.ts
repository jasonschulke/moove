import { describe, it, expect, beforeEach } from 'vitest';
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

  it('counts a rolling week and month', () => {
    saveSessions([session(0), session(3), session(10), session(60)]);
    const stats = getWorkoutStats();
    expect(stats.totalWorkouts).toBe(4);
    expect(stats.thisWeek).toBe(2);
    expect(stats.thisMonth).toBe(3);
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
