import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_HABITS, HABIT_ICONS, HABIT_ICON_GROUPS, HABIT_COLORS, habitColor,
  loadHabits, saveHabits, addHabit, updateHabit, deleteHabit, moveHabit, describeCadence,
  dailyHabits, weeklyHabits, loadHabitLogs,
  isHabitDone, setHabitDone, toggleHabit, countDoneInWeek,
} from './habits';
import type { Habit } from '../types/habits';

const byId = (id: string): Habit => {
  const h = loadHabits().find(x => x.id === id);
  if (!h) throw new Error(`no habit ${id}`);
  return h;
};

/** A habit that opts into starting each day done, which none of the five do. */
const held = (): Habit =>
  ({ id: 'kept', name: 'Kept', cadence: { kind: 'daily' }, heldByDefault: true, order: 9 });

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

  it('hold nothing by default', () => {
    // A habit that starts each day ticked made the ring read 1 of 3 before
    // anything had happened. The mechanism stays; the default does not.
    expect(loadHabits().filter(h => h.heldByDefault)).toEqual([]);
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

  it('is true by default for a habit that opts into being held', () => {
    expect(isHabitDone(held(), '2026-09-15', {})).toBe(true);
  });

  it('prefers an explicit log over the default, in both directions', () => {
    const logs = { '2026-09-15': { walk: true, kept: false } };
    expect(isHabitDone(byId('walk'), '2026-09-15', logs)).toBe(true);
    expect(isHabitDone(held(), '2026-09-15', logs)).toBe(false);
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
    const logs = toggleHabit(held(), '2026-09-15');
    expect(isHabitDone(held(), '2026-09-15', logs)).toBe(false);
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
    expect(countDoneInWeek(held(), tuesday, {})).toBe(7);
  });

  it('subtracts the days a held habit was broken', () => {
    const logs = { '2026-09-14': { kept: false }, '2026-09-16': { kept: false } };
    expect(countDoneInWeek(held(), tuesday, logs)).toBe(5);
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

describe('icons', () => {
  it('gives every seeded habit one', () => {
    expect(loadHabits().every(h => !!h.icon)).toBe(true);
  });

  it('only seeds icons the picker offers', () => {
    for (const habit of DEFAULT_HABITS) {
      expect(HABIT_ICONS, habit.name).toContain(habit.icon!);
    }
  });

  it('offers no duplicates', () => {
    expect(new Set(HABIT_ICONS).size).toBe(HABIT_ICONS.length);
  });

  it('names icons as Material Symbols ligatures', () => {
    // Anything else renders as raw text where the font expects a ligature.
    for (const icon of HABIT_ICONS) {
      expect(icon, icon).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it('keeps every group the same width so the grid stays square', () => {
    for (const group of HABIT_ICON_GROUPS) {
      expect(group.icons.length, group.label).toBe(9);
    }
  });

  it('stores an icon on a new habit', () => {
    const added = addHabit({
      name: 'Stretch', cadence: { kind: 'daily' }, heldByDefault: false, icon: 'self_improvement',
    });
    expect(loadHabits().find(h => h.id === added.id)!.icon).toBe('self_improvement');
  });

  it('changes one on edit', () => {
    updateHabit('walk', { icon: 'hiking' });
    expect(loadHabits().find(h => h.id === 'walk')!.icon).toBe('hiking');
  });

  it('clears one back to none', () => {
    updateHabit('walk', { icon: undefined });
    expect(loadHabits().find(h => h.id === 'walk')!.icon).toBeUndefined();
  });

  it('tolerates a habit stored before icons existed', () => {
    saveHabits([{ id: 'old', name: 'Old', cadence: { kind: 'daily' }, heldByDefault: false, order: 0 }]);
    expect(loadHabits()[0].icon).toBeUndefined();
  });
});

describe('colour', () => {
  it('gives every seeded habit one', () => {
    expect(loadHabits().every(h => !!h.color)).toBe(true);
  });

  it('only seeds colours the picker offers', () => {
    const keys = HABIT_COLORS.map(c => c.key);
    for (const habit of DEFAULT_HABITS) expect(keys, habit.name).toContain(habit.color!);
  });

  it('gives the five different colours, so a list reads as a list', () => {
    const used = DEFAULT_HABITS.map(h => h.color);
    expect(new Set(used).size).toBe(used.length);
  });

  it('resolves to a CSS colour', () => {
    expect(habitColor({ color: 'plum' })).toBe('#7c3aed');
  });

  it('falls back to the app green with no colour or an unknown one', () => {
    expect(habitColor({})).toBe('var(--mv-green)');
    expect(habitColor({ color: 'chartreuse' })).toBe('var(--mv-green)');
  });

  it('stores a colour on a new habit and changes it on edit', () => {
    const added = addHabit({
      name: 'Stretch', cadence: { kind: 'daily' }, heldByDefault: false, color: 'teal',
    });
    expect(loadHabits().find(h => h.id === added.id)!.color).toBe('teal');
    updateHabit(added.id, { color: 'rose' });
    expect(loadHabits().find(h => h.id === added.id)!.color).toBe('rose');
  });
});

describe('the held-by-default migration', () => {
  it('turns off a habit that was held, once', () => {
    saveHabits([{ id: 'dry', name: 'Dry day', cadence: { kind: 'daily' }, heldByDefault: true, order: 0 }]);
    localStorage.removeItem('habit_held_default_off');
    expect(loadHabits()[0].heldByDefault).toBe(false);
  });

  it('leaves a later deliberate choice alone', () => {
    loadHabits();                       // runs the migration
    updateHabit('walk', { heldByDefault: true });
    expect(loadHabits().find(h => h.id === 'walk')!.heldByDefault).toBe(true);
  });
});
