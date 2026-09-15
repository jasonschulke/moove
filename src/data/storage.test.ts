import { describe, it, expect, beforeEach } from 'vitest';
import type { WorkoutSession } from '../types';
import {
  formatLocalDate,
  saveSessions,
  loadSessions,
  addCompletedSession,
  deleteSession,
  saveCurrentSession,
  loadCurrentSession,
  loadSavedWorkouts,
  seedDefaultWorkouts,
  deleteSavedWorkout,
  toggleRestDay,
  isRestDay,
  hasWorkoutOnDate,
  hasRealWorkoutOnDate,
  addBacklogWorkout,
} from './storage';

function session(id: string, startedAt: string): WorkoutSession {
  return {
    id,
    name: 'Test Workout',
    blocks: [],
    startedAt,
    completedAt: startedAt,
    exercises: [],
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('formatLocalDate', () => {
  it('formats as YYYY-MM-DD in local time, not UTC', () => {
    // Late evening local time; a UTC-based formatter would roll to the next day
    // for anyone west of Greenwich.
    const d = new Date(2026, 8, 15, 23, 30);
    expect(formatLocalDate(d)).toBe('2026-09-15');
  });

  it('zero-pads single digit months and days', () => {
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('sessions', () => {
  it('round-trips through localStorage', () => {
    const s = session('a', new Date().toISOString());
    saveSessions([s]);
    expect(loadSessions()).toHaveLength(1);
    expect(loadSessions()[0].id).toBe('a');
  });

  it('returns an empty list rather than throwing when nothing is stored', () => {
    expect(loadSessions()).toEqual([]);
  });

  it('puts the newest completed session first', () => {
    addCompletedSession(session('older', new Date(2026, 8, 1).toISOString()));
    addCompletedSession(session('newer', new Date(2026, 8, 10).toISOString()));
    expect(loadSessions()[0].id).toBe('newer');
  });

  it('deletes by id and leaves the rest alone', () => {
    saveSessions([
      session('a', new Date().toISOString()),
      session('b', new Date().toISOString()),
    ]);
    deleteSession('a');
    const remaining = loadSessions();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('b');
  });

  it('clears the in-progress session when saved as null', () => {
    saveCurrentSession(session('live', new Date().toISOString()));
    expect(loadCurrentSession()).not.toBeNull();
    saveCurrentSession(null);
    expect(loadCurrentSession()).toBeNull();
  });
});

describe('seedDefaultWorkouts', () => {
  it('adds the default workout on a clean install', () => {
    seedDefaultWorkouts();
    expect(loadSavedWorkouts()).toHaveLength(1);
  });

  it('is idempotent across repeated app loads', () => {
    seedDefaultWorkouts();
    seedDefaultWorkouts();
    seedDefaultWorkouts();
    expect(loadSavedWorkouts()).toHaveLength(1);
  });

  // The whole point of the seeded-once flag: deleting the default should make
  // it stay deleted.
  it('does not resurrect a workout the user deleted', () => {
    seedDefaultWorkouts();
    const [saved] = loadSavedWorkouts();
    deleteSavedWorkout(saved.id);
    seedDefaultWorkouts();
    expect(loadSavedWorkouts()).toHaveLength(0);
  });
});

describe('rest days', () => {
  it('toggles on and off', () => {
    expect(isRestDay('2026-09-13')).toBe(false);
    toggleRestDay('2026-09-13');
    expect(isRestDay('2026-09-13')).toBe(true);
    toggleRestDay('2026-09-13');
    expect(isRestDay('2026-09-13')).toBe(false);
  });
});

describe('backlog workouts', () => {
  it('marks a date as worked out without counting as a real session', () => {
    const dateStr = '2026-09-10';
    addBacklogWorkout(dateStr);
    expect(hasWorkoutOnDate(dateStr)).toBe(true);
    expect(hasRealWorkoutOnDate(dateStr)).toBe(false);
  });

  it('counts a logged session as a real workout', () => {
    const when = new Date(2026, 8, 11, 9, 0);
    addCompletedSession({
      ...session('real', when.toISOString()),
      exercises: [{ exerciseId: 'pushups', reps: 10, completedAt: when.toISOString() }],
    });
    expect(hasRealWorkoutOnDate(formatLocalDate(when))).toBe(true);
  });
});
