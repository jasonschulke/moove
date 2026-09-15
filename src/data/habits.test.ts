import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  DEFAULT_HABITS, HABIT_ICONS, HABIT_ICON_GROUPS, HABIT_COLORS, habitColor,
  loadHabits, saveHabits, addHabit, updateHabit, deleteHabit, moveHabit, describeCadence,
  dailyHabits, weeklyHabits, loadHabitLogs,
  isHabitDone, habitValue, setHabitDone, toggleHabit, countDoneInWeek,
  recordHabitValue, dayScore, earliestMeasuredDate,
  habitSeries, measuredHabits, HABIT_UNITS,
  habitsOn, loadArchivedHabits,
} from './habits';
import { loadBodyMetrics } from './storage';
import type { Habit } from '../types/habits';

const byId = (id: string): Habit => {
  const h = loadHabits().find(x => x.id === id);
  if (!h) throw new Error(`no habit ${id}`);
  return h;
};

/** A habit that opts into starting each day done, which no default does. */
const held = (): Habit =>
  ({ id: 'kept', name: 'Kept', cadence: { kind: 'daily' }, heldByDefault: true, order: 9 });

// Habits are stamped with the day they started, so the clock has to be still.
beforeEach(() => {
  localStorage.clear();
  vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0)); // Tuesday 15 September 2026
});
afterAll(() => { vi.useRealTimers(); });

/** Backdates the seeded habits, for tests that score days before today. */
const trackingSince = (dateStr: string) =>
  saveHabits(loadHabits().map(h => ({ ...h, createdOn: dateStr })));

describe('the seeded defaults', () => {
  it('hold the six tracked things with the right cadences', () => {
    expect(loadHabits().map(h => h.id)).toEqual(['walk', 'dog', 'dry', 'lift', 'run', 'weight']);
    expect(byId('walk').cadence).toEqual({ kind: 'daily' });
    expect(byId('dog').cadence).toEqual({ kind: 'daily' });
    expect(byId('dry').cadence).toEqual({ kind: 'daily-quota', perWeek: 5 });
    expect(byId('lift').cadence).toEqual({ kind: 'weekly', perWeek: 3 });
    expect(byId('run').cadence).toEqual({ kind: 'weekly', perWeek: 1 });
    expect(byId('weight').cadence).toEqual({ kind: 'daily' });
  });

  it('stamp themselves with a start date on first load', () => {
    loadHabits();
    expect(loadHabits().every(h => h.createdOn === '2026-09-15')).toBe(true);
  });

  it('take their start date from the earliest log when there is one', () => {
    localStorage.setItem('habit_logs', JSON.stringify({ '2026-09-02': { walk: true } }));
    loadHabits();
    expect(byId('walk').createdOn).toBe('2026-09-02');
    expect(byId('dog').createdOn).toBe('2026-09-15');
  });

  it('give weight a unit and point it at the body metrics it already has', () => {
    expect(byId('weight').unit).toBe('lb');
    expect(byId('weight').source).toBe('bodyWeight');
  });

  it('hold nothing by default', () => {
    // A habit that starts each day ticked made the ring read 1 of 3 before
    // anything had happened. The mechanism stays; the default does not.
    expect(loadHabits().filter(h => h.heldByDefault)).toEqual([]);
  });
});

describe('dailyHabits and weeklyHabits', () => {
  it('splits the six by cadence', () => {
    expect(dailyHabits().map(h => h.id)).toEqual(['walk', 'dog', 'dry', 'weight']);
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

describe('a measured habit', () => {
  const weight = () => byId('weight');

  it('is not done until there is a reading', () => {
    expect(isHabitDone(weight(), '2026-09-15', {})).toBe(false);
    expect(habitValue(weight(), '2026-09-15', {})).toBeNull();
  });

  it('records the reading in body metrics, not the habit log', () => {
    recordHabitValue('weight', '2026-09-15', 182.35);
    expect(loadHabitLogs()).toEqual({});
    expect(loadBodyMetrics()).toEqual([{ date: '2026-09-15', weight: 182.4, source: 'manual' }]);
  });

  it('counts as done by virtue of having a reading', () => {
    recordHabitValue('weight', '2026-09-15', 182);
    expect(isHabitDone(weight(), '2026-09-15', {})).toBe(true);
    expect(habitValue(weight(), '2026-09-15', {})).toBe(182);
    expect(isHabitDone(weight(), '2026-09-16', {})).toBe(false);
  });

  it('picks up a reading that arrived from Health', () => {
    localStorage.setItem('body_metrics', JSON.stringify(
      [{ date: '2026-09-15', weight: 181, source: 'apple_health' }]));
    expect(isHabitDone(weight(), '2026-09-15', {})).toBe(true);
  });

  it('clears back to undone', () => {
    recordHabitValue('weight', '2026-09-15', 182);
    setHabitDone('weight', '2026-09-15', false);
    expect(isHabitDone(weight(), '2026-09-15', {})).toBe(false);
    expect(loadBodyMetrics()).toEqual([]);
  });

  it('refuses a reading that cannot be a weight', () => {
    expect(recordHabitValue('weight', '2026-09-15', 0)).toBeNull();
    expect(recordHabitValue('weight', '2026-09-15', NaN)).toBeNull();
    expect(isHabitDone(weight(), '2026-09-15', {})).toBe(false);
  });
});

describe('a measured habit with a goal', () => {
  /** A measured habit of the user's own, which stores in the habit log. */
  const water = (over: Partial<Habit> = {}): Habit => addHabit({
    name: 'Water', cadence: { kind: 'daily' }, heldByDefault: false,
    unit: 'oz', target: 64, targetDirection: 'atLeast', ...over,
  });

  it('is done on any reading, short of the target or not', () => {
    // The target is a goal line on the chart, not a gate on the day. A weight
    // goal is months out; holding the ring open for it every morning punishes
    // you for doing the actual daily task, which is taking the reading.
    const h = water();
    recordHabitValue(h.id, '2026-09-15', 48);
    expect(isHabitDone(h, '2026-09-15', loadHabitLogs())).toBe(true);
    expect(habitValue(h, '2026-09-15', loadHabitLogs())).toBe(48);
  });

  it('is not done on a day with no reading', () => {
    const h = water();
    recordHabitValue(h.id, '2026-09-15', 64);
    expect(isHabitDone(h, '2026-09-16', loadHabitLogs())).toBe(false);
  });

  it('counts toward the day on any reading', () => {
    const h = water();
    expect(dayScore('2026-09-15', loadHabitLogs()).completed).toBe(0);
    recordHabitValue(h.id, '2026-09-15', 1);
    expect(dayScore('2026-09-15', loadHabitLogs()).completed).toBe(1);
  });

});

describe('habitSeries and measuredHabits', () => {
  it('lists only the habits that carry a unit', () => {
    expect(measuredHabits().map(h => h.id)).toEqual(['weight']);
    addHabit({ name: 'Water', cadence: { kind: 'daily' }, heldByDefault: false, unit: 'oz' });
    expect(measuredHabits().map(h => h.name)).toEqual(['Weight', 'Water']);
  });

  it('returns readings oldest first, from the habit log', () => {
    const h = addHabit({ name: 'Water', cadence: { kind: 'daily' }, heldByDefault: false, unit: 'oz' });
    recordHabitValue(h.id, '2026-09-16', 70);
    recordHabitValue(h.id, '2026-09-14', 50);
    expect(habitSeries(h, loadHabitLogs()))
      .toEqual([{ date: '2026-09-14', value: 50 }, { date: '2026-09-16', value: 70 }]);
  });

  it('reads weight from the body metrics instead', () => {
    recordHabitValue('weight', '2026-09-15', 182.4);
    expect(habitSeries(byId('weight'), loadHabitLogs()))
      .toEqual([{ date: '2026-09-15', value: 182.4 }]);
  });

  it('is empty for a habit that is only a tick', () => {
    setHabitDone('walk', '2026-09-15', true);
    expect(habitSeries(byId('walk'), loadHabitLogs())).toEqual([]);
  });

  it('offers units worth not typing on a phone', () => {
    expect(HABIT_UNITS).toContain('lb');
    expect(new Set(HABIT_UNITS).size).toBe(HABIT_UNITS.length);
  });
});

describe('filling in an older day', () => {
  it('moves the habit start back to meet the log', () => {
    trackingSince('2026-09-10');
    setHabitDone('walk', '2026-09-03', true);
    expect(byId('walk').createdOn).toBe('2026-09-03');
    expect(dayScore('2026-09-03', loadHabitLogs())).toEqual({ completed: 1, total: 1 });
  });

  it('leaves the start alone when logging inside the tracked range', () => {
    trackingSince('2026-09-10');
    setHabitDone('walk', '2026-09-12', true);
    expect(byId('walk').createdOn).toBe('2026-09-10');
  });

  it('does not backdate when clearing a habit', () => {
    trackingSince('2026-09-10');
    setHabitDone('walk', '2026-09-03', false);
    expect(byId('walk').createdOn).toBe('2026-09-10');
  });

  it('backdates on a reading too', () => {
    trackingSince('2026-09-10');
    recordHabitValue('weight', '2026-09-04', 182);
    expect(byId('weight').createdOn).toBe('2026-09-04');
  });
});

describe('habitsOn', () => {
  it('ignores a habit on days before it existed', () => {
    trackingSince('2026-09-01');
    addHabit({ name: 'Stretch', cadence: { kind: 'daily' }, heldByDefault: false });
    expect(habitsOn('2026-08-31').map(h => h.name)).not.toContain('Stretch');
    expect(habitsOn('2026-09-15').map(h => h.name)).toContain('Stretch');
  });

  it('stops a new habit from rewriting the past', () => {
    trackingSince('2026-09-01');
    const before = dayScore('2026-09-10', { '2026-09-10': { walk: true } });
    addHabit({ name: 'Stretch', cadence: { kind: 'daily' }, heldByDefault: false });
    expect(dayScore('2026-09-10', { '2026-09-10': { walk: true } })).toEqual(before);
    // Today does widen, because today is when it started.
    expect(dayScore('2026-09-15', {}).total).toBe(before.total + 1);
  });

  it('keeps a deleted habit in the days it was part of', () => {
    trackingSince('2026-09-01');
    deleteHabit('dry');
    expect(habitsOn('2026-09-14').map(h => h.id)).toContain('dry');
    expect(habitsOn('2026-09-15').map(h => h.id)).not.toContain('dry');
  });

  it('archives the definition rather than dropping it', () => {
    trackingSince('2026-09-01');
    deleteHabit('dry');
    const archived = loadArchivedHabits();
    expect(archived.map(h => h.id)).toEqual(['dry']);
    expect(archived[0].deletedOn).toBe('2026-09-15');
    expect(archived[0].name).toBe('Dry day');
  });

  it('does not let deleting a habit you were failing improve the past', () => {
    trackingSince('2026-09-01');
    const before = dayScore('2026-09-10', { '2026-09-10': { walk: true } });
    deleteHabit('dry');
    expect(dayScore('2026-09-10', { '2026-09-10': { walk: true } })).toEqual(before);
  });
});

describe('earliestMeasuredDate', () => {
  it('is nothing until a reading is entered', () => {
    expect(earliestMeasuredDate()).toBeNull();
  });

  it('is the first reading you entered yourself', () => {
    recordHabitValue('weight', '2026-09-15', 182);
    recordHabitValue('weight', '2026-09-12', 183);
    expect(earliestMeasuredDate()).toBe('2026-09-12');
  });

  it('ignores an import, which is history rather than tracking', () => {
    // Years of Health data would otherwise backdate the start of tracking and
    // fill the year grid with months scored near zero.
    localStorage.setItem('body_metrics', JSON.stringify([
      { date: '2019-04-01', weight: 190, source: 'apple_health' },
      { date: '2026-09-15', weight: 182, source: 'manual' },
    ]));
    expect(earliestMeasuredDate()).toBe('2026-09-15');
  });
});

describe('dayScore', () => {
  it('is daily habits over daily habits when no weekly one was done', () => {
    expect(dayScore('2026-09-15', { '2026-09-15': { walk: true } }))
      .toEqual({ completed: 1, total: 4 });
  });

  it('adds a weekly habit to both halves on the day it is done', () => {
    // Lift today and the day is out of five, not four. Credit, never dilution.
    expect(dayScore('2026-09-15', { '2026-09-15': { walk: true, lift: true } }))
      .toEqual({ completed: 2, total: 5 });
  });

  it('does not hold a slot open for a weekly habit you skipped', () => {
    expect(dayScore('2026-09-15', { '2026-09-16': { lift: true } }))
      .toEqual({ completed: 0, total: 4 });
  });

  it('can close a day that includes a weekly habit', () => {
    recordHabitValue('weight', '2026-09-15', 182);
    const score = dayScore('2026-09-15',
      { '2026-09-15': { walk: true, dog: true, dry: true, lift: true, run: true } });
    expect(score).toEqual({ completed: 6, total: 6 });
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
    expect(habits.map(h => h.id)).toEqual(['walk', 'dog', 'dry', 'lift', 'run', 'weight']);
  });

  it('returns null when updating a habit that is gone', () => {
    expect(updateHabit('nope', { name: 'x' })).toBeNull();
  });

  it('deletes a habit and closes the gap in the order', () => {
    deleteHabit('dry');
    const habits = loadHabits();
    expect(habits.map(h => h.id)).toEqual(['walk', 'dog', 'lift', 'run', 'weight']);
    expect(habits.map(h => h.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it('moves a habit down', () => {
    moveHabit('walk', 1);
    expect(loadHabits().map(h => h.id)).toEqual(['dog', 'walk', 'dry', 'lift', 'run', 'weight']);
  });

  it('moves a habit up', () => {
    moveHabit('dry', -1);
    expect(loadHabits().map(h => h.id)).toEqual(['walk', 'dry', 'dog', 'lift', 'run', 'weight']);
  });

  it('does nothing at either end', () => {
    moveHabit('walk', -1);
    expect(loadHabits().map(h => h.id)).toEqual(['walk', 'dog', 'dry', 'lift', 'run', 'weight']);
    moveHabit('weight', 1);
    expect(loadHabits().map(h => h.id)).toEqual(['walk', 'dog', 'dry', 'lift', 'run', 'weight']);
  });

  it('widens the ring when a daily habit is added', () => {
    expect(dailyHabits().length).toBe(4);
    addHabit({ name: 'Stretch', cadence: { kind: 'daily' }, heldByDefault: false });
    expect(dailyHabits().length).toBe(5);
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

  it('gives the defaults different colours, so a list reads as a list', () => {
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
