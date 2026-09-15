import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_HABITS, loadHabits, saveHabits, addHabit, updateHabit, deleteHabit, moveHabit, describeCadence,
  dailyHabits, weeklyHabits, loadHabitLogs,
  isHabitDone, setHabitDone, toggleHabit, countDoneInWeek,
} from './habits';
import type { Habit } from '../types/habits';

const byId = (id: string): Habit => {
  const h = loadHabits().find(x => x.id === id);
  if (!h) throw new Error(`no habit ${id}`);
  return h;
};

beforeEach(() => { localStorage.clear(); });

describe('the seeded defaults', () => {
  it('hold the five tracked things with the right cadences', () => {
    expect(loadHabits().map(h => h.id)).toEqual(['walk', 'dog', 'dry', 'lift', 'run']);
    expect(byId('walk').cadence).toEqual({ kind: 'daily' });
    expect(byId('dog').cadence).toEqual({ kind: 'daily' });
    expect(byId('dry').cadence).toEqual({ kind: 'daily-quota', perWeek: 5 });
    expect(byId('lift').cadence).toEqual({ kind: 'weekly', perWeek: 3 });
    expect(byId('run').cadence).toEqual({ kind: 'weekly', perWeek: 1 });
  });

  it('hold the dry day by default and nothing else', () => {
    expect(loadHabits().filter(h => h.heldByDefault).map(h => h.id)).toEqual(['dry']);
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

describe('managing the list', () => {
  it('seeds the defaults on a clean install', () => {
    expect(loadHabits().map(h => h.id)).toEqual(DEFAULT_HABITS.map(h => h.id));
  });

  it('does not bring the defaults back after they are all deleted', () => {
    loadHabits();                       // seed
    saveHabits([]);                     // then clear
    expect(loadHabits()).toEqual([]);
  });

  it('adds a habit at the end', () => {
    const added = addHabit({ name: 'Stretch', cadence: { kind: 'daily' }, heldByDefault: false });
    const habits = loadHabits();
    expect(habits[habits.length - 1].id).toBe(added.id);
    expect(habits[habits.length - 1].name).toBe('Stretch');
  });

  it('gives a new habit its own id', () => {
    const a = addHabit({ name: 'A', cadence: { kind: 'daily' }, heldByDefault: false });
    const b = addHabit({ name: 'B', cadence: { kind: 'daily' }, heldByDefault: false });
    expect(a.id).not.toBe(b.id);
  });

  it('updates a habit in place without moving it', () => {
    updateHabit('dog', { name: 'Dog walk', cadence: { kind: 'weekly', perWeek: 4 } });
    const habits = loadHabits();
    expect(habits[1].name).toBe('Dog walk');
    expect(habits[1].cadence).toEqual({ kind: 'weekly', perWeek: 4 });
    expect(habits.map(h => h.id)).toEqual(['walk', 'dog', 'dry', 'lift', 'run']);
  });

  it('returns null when updating a habit that is gone', () => {
    expect(updateHabit('nope', { name: 'x' })).toBeNull();
  });

  it('deletes a habit and closes the gap in the order', () => {
    deleteHabit('dry');
    const habits = loadHabits();
    expect(habits.map(h => h.id)).toEqual(['walk', 'dog', 'lift', 'run']);
    expect(habits.map(h => h.order)).toEqual([0, 1, 2, 3]);
  });

  it('moves a habit down', () => {
    moveHabit('walk', 1);
    expect(loadHabits().map(h => h.id)).toEqual(['dog', 'walk', 'dry', 'lift', 'run']);
  });

  it('moves a habit up', () => {
    moveHabit('dry', -1);
    expect(loadHabits().map(h => h.id)).toEqual(['walk', 'dry', 'dog', 'lift', 'run']);
  });

  it('does nothing at either end', () => {
    moveHabit('walk', -1);
    expect(loadHabits().map(h => h.id)).toEqual(['walk', 'dog', 'dry', 'lift', 'run']);
    moveHabit('run', 1);
    expect(loadHabits().map(h => h.id)).toEqual(['walk', 'dog', 'dry', 'lift', 'run']);
  });

  it('widens the ring when a daily habit is added', () => {
    expect(dailyHabits().length).toBe(3);
    addHabit({ name: 'Stretch', cadence: { kind: 'daily' }, heldByDefault: false });
    expect(dailyHabits().length).toBe(4);
  });

  it('survives corrupt stored data by falling back to the defaults', () => {
    localStorage.setItem('habit_definitions', '{not an array');
    expect(loadHabits().map(h => h.id)).toEqual(DEFAULT_HABITS.map(h => h.id));
  });
});

describe('describeCadence', () => {
  it('reads plainly for each cadence', () => {
    expect(describeCadence({ kind: 'daily' }, false)).toBe('Every day');
    expect(describeCadence({ kind: 'daily-quota', perWeek: 5 }, false)).toBe('5 of 7 days');
    expect(describeCadence({ kind: 'weekly', perWeek: 3 }, false)).toBe('3× a week');
  });

  it('says so when a habit is held', () => {
    expect(describeCadence({ kind: 'daily-quota', perWeek: 5 }, true))
      .toBe('5 of 7 days, held unless you break it');
  });
});
