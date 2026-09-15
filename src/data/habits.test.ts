import { describe, it, expect, beforeEach } from 'vitest';
import {
  HABITS, dailyHabits, weeklyHabits, loadHabitLogs,
  isHabitDone, setHabitDone, toggleHabit, countDoneInWeek,
} from './habits';
import type { Habit } from '../types/habits';

const byId = (id: string): Habit => {
  const h = HABITS.find(x => x.id === id);
  if (!h) throw new Error(`no habit ${id}`);
  return h;
};

beforeEach(() => { localStorage.clear(); });

describe('HABITS', () => {
  it('holds the five tracked things with the right cadences', () => {
    expect(HABITS.map(h => h.id)).toEqual(['walk', 'dog', 'dry', 'lift', 'run']);
    expect(byId('walk').cadence).toEqual({ kind: 'daily' });
    expect(byId('dog').cadence).toEqual({ kind: 'daily' });
    expect(byId('dry').cadence).toEqual({ kind: 'daily-quota', perWeek: 5 });
    expect(byId('lift').cadence).toEqual({ kind: 'weekly', perWeek: 3 });
    expect(byId('run').cadence).toEqual({ kind: 'weekly', perWeek: 1 });
  });

  it('holds the dry day by default and nothing else', () => {
    expect(HABITS.filter(h => h.heldByDefault).map(h => h.id)).toEqual(['dry']);
  });
});

describe('dailyHabits and weeklyHabits', () => {
  it('splits the five so the day score always has a denominator of three', () => {
    expect(dailyHabits().map(h => h.id)).toEqual(['walk', 'dog', 'dry']);
    expect(weeklyHabits().map(h => h.id)).toEqual(['lift', 'run']);
  });
});

describe('isHabitDone', () => {
  it('is false by default for an ordinary habit', () => {
    expect(isHabitDone(byId('walk'), '2026-09-15', {})).toBe(false);
  });

  it('is true by default for a held habit', () => {
    expect(isHabitDone(byId('dry'), '2026-09-15', {})).toBe(true);
  });

  it('prefers an explicit log over the default, in both directions', () => {
    const logs = { '2026-09-15': { walk: true, dry: false } };
    expect(isHabitDone(byId('walk'), '2026-09-15', logs)).toBe(true);
    expect(isHabitDone(byId('dry'), '2026-09-15', logs)).toBe(false);
  });

  it('does not let one day leak into another', () => {
    expect(isHabitDone(byId('walk'), '2026-09-16', { '2026-09-15': { walk: true } })).toBe(false);
  });
});

describe('setHabitDone and persistence', () => {
  it('writes through to localStorage', () => {
    setHabitDone('walk', '2026-09-15', true);
    expect(loadHabitLogs()).toEqual({ '2026-09-15': { walk: true } });
  });

  it('keeps other habits on the same day', () => {
    setHabitDone('walk', '2026-09-15', true);
    setHabitDone('dog', '2026-09-15', true);
    expect(loadHabitLogs()['2026-09-15']).toEqual({ walk: true, dog: true });
  });

  it('keeps other days', () => {
    setHabitDone('walk', '2026-09-14', true);
    setHabitDone('walk', '2026-09-15', true);
    expect(Object.keys(loadHabitLogs()).sort()).toEqual(['2026-09-14', '2026-09-15']);
  });

  it('records false explicitly rather than deleting the entry', () => {
    setHabitDone('dry', '2026-09-15', false);
    expect(loadHabitLogs()).toEqual({ '2026-09-15': { dry: false } });
  });
});

describe('loadHabitLogs', () => {
  it('returns an empty map when nothing is stored', () => {
    expect(loadHabitLogs()).toEqual({});
  });

  it('returns an empty map rather than throwing on corrupt data', () => {
    localStorage.setItem('habit_logs', '{not json');
    expect(loadHabitLogs()).toEqual({});
  });
});

describe('toggleHabit', () => {
  it('turns an ordinary habit on then off', () => {
    let logs = toggleHabit(byId('walk'), '2026-09-15');
    expect(isHabitDone(byId('walk'), '2026-09-15', logs)).toBe(true);
    logs = toggleHabit(byId('walk'), '2026-09-15');
    expect(isHabitDone(byId('walk'), '2026-09-15', logs)).toBe(false);
  });

  it('breaks a held habit on the first tap', () => {
    const logs = toggleHabit(byId('dry'), '2026-09-15');
    expect(isHabitDone(byId('dry'), '2026-09-15', logs)).toBe(false);
  });
});

describe('countDoneInWeek', () => {
  const tuesday = new Date(2026, 8, 15, 12, 0, 0); // week is Mon 14 to Sun 20

  it('counts only days inside the Monday to Sunday week', () => {
    const logs = {
      '2026-09-13': { lift: true }, // Sunday, previous week
      '2026-09-14': { lift: true },
      '2026-09-15': { lift: true },
      '2026-09-21': { lift: true }, // Monday, next week
    };
    expect(countDoneInWeek(byId('lift'), tuesday, logs)).toBe(2);
  });

  it('counts a held habit on every day of the week that was not broken', () => {
    expect(countDoneInWeek(byId('dry'), tuesday, {})).toBe(7);
  });

  it('subtracts the days a held habit was broken', () => {
    const logs = { '2026-09-14': { dry: false }, '2026-09-16': { dry: false } };
    expect(countDoneInWeek(byId('dry'), tuesday, logs)).toBe(5);
  });

  it('is zero for an ordinary habit with no logs', () => {
    expect(countDoneInWeek(byId('lift'), tuesday, {})).toBe(0);
  });
});
