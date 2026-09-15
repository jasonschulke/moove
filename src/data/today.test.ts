import { describe, it, expect, beforeEach } from 'vitest';
import { getTodayView, debtSituation, daySituation } from './today';
import type { HabitLogMap } from '../types/habits';
import { recordHabitValue } from './habits';

/** Weight lives in body metrics, so a weigh-in is the way to tick that habit. */
const weighIn = (dateStr: string) => recordHabitValue('weight', dateStr, 182);

// Tuesday 15 September 2026. Week is Mon 14 to Sun 20: six days left counting today.
const tuesday = () => new Date(2026, 8, 15, 12, 0, 0);

beforeEach(() => { localStorage.clear(); });

describe('debtSituation', () => {
  it('names the last day of the week', () => {
    expect(debtSituation(1, 1)).toBe('debtLastDay');
    expect(debtSituation(3, 1)).toBe('debtLastDay');
  });

  it('is tight when the debt fills the week', () => {
    expect(debtSituation(3, 3)).toBe('debtTight');
    expect(debtSituation(4, 3)).toBe('debtTight');
  });

  it('is comfortable when there is room', () => {
    expect(debtSituation(2, 6)).toBe('debtComfortable');
    expect(debtSituation(1, 4)).toBe('debtComfortable');
  });
});

describe('daySituation', () => {
  it('reads the day', () => {
    expect(daySituation(0, 3, false)).toBe('dayEmpty');
    expect(daySituation(1, 3, false)).toBe('dayPartial');
    expect(daySituation(3, 3, false)).toBe('dayClosed');
  });

  it('a rest day overrides the rest', () => {
    expect(daySituation(0, 3, true)).toBe('dayRest');
    expect(daySituation(3, 3, true)).toBe('dayRest');
  });
});

describe('getTodayView', () => {
  it('is out of the four daily habits when nothing weekly was done', () => {
    expect(getTodayView(tuesday(), {}).total).toBe(4);
  });

  it('starts an untouched day at zero', () => {
    // Nothing is held by default any more, so nothing is done before you do it.
    expect(getTodayView(tuesday(), {}).completed).toBe(0);
  });

  it('counts each logged daily habit', () => {
    const logs: HabitLogMap = { '2026-09-15': { walk: true, dog: true, dry: true } };
    expect(getTodayView(tuesday(), logs).completed).toBe(3);
  });

  it('counts only what was logged', () => {
    const logs: HabitLogMap = { '2026-09-15': { walk: true, dog: true, dry: false } };
    expect(getTodayView(tuesday(), logs).completed).toBe(2);
  });

  it('counts a weekly habit on the day it is done, in both halves', () => {
    const view = getTodayView(tuesday(), { '2026-09-15': { lift: true, run: true } });
    expect(view.completed).toBe(2);
    expect(view.total).toBe(6);
  });

  it('leaves no gap for a weekly habit that was not done today', () => {
    const view = getTodayView(tuesday(), { '2026-09-14': { lift: true } });
    expect(view.completed).toBe(0);
    expect(view.total).toBe(4);
  });

  it('lets a weekly habit close the day rather than dilute it', () => {
    weighIn('2026-09-15');
    const logs: HabitLogMap = { '2026-09-15': { walk: true, dog: true, dry: true, lift: true } };
    const view = getTodayView(tuesday(), logs);
    expect([view.completed, view.total]).toEqual([5, 5]);
    expect(view.daySituation).toBe('dayClosed');
  });

  it('reports the reading on a measured habit', () => {
    recordHabitValue('weight', '2026-09-15', 182.4);
    const weight = getTodayView(tuesday(), {}).statuses.find(s => s.habit.id === 'weight')!;
    expect([weight.done, weight.value]).toEqual([true, 182.4]);
  });

  it('leaves value null on a habit with no unit', () => {
    const walk = getTodayView(tuesday(), { '2026-09-15': { walk: true } })
      .statuses.find(s => s.habit.id === 'walk')!;
    expect(walk.value).toBeNull();
  });

  it('reports the day of the month', () => {
    expect(getTodayView(tuesday(), {}).dayOfMonth).toBe(15);
  });

  it('returns a status for all six habits, in order', () => {
    expect(getTodayView(tuesday(), {}).statuses.map(s => s.habit.id))
      .toEqual(['walk', 'dog', 'dry', 'lift', 'run', 'weight']);
  });

  it('reports weekly debt on the weekly rows', () => {
    const view = getTodayView(tuesday(), { '2026-09-14': { lift: true } });
    const lift = view.statuses.find(s => s.habit.id === 'lift')!;
    expect([lift.doneThisWeek, lift.perWeek, lift.owed]).toEqual([1, 3, 2]);
  });

  it('never reports negative debt', () => {
    const logs: HabitLogMap = { '2026-09-14': { run: true }, '2026-09-15': { run: true } };
    expect(getTodayView(tuesday(), logs).statuses.find(s => s.habit.id === 'run')!.owed).toBe(0);
  });
});

describe('getTodayView suggestion', () => {
  it('suggests the weekly habit under the most pressure', () => {
    // Lift owes 3 over 6 days (0.5). Run owes 1 over 6 days (0.17).
    const view = getTodayView(tuesday(), {});
    expect(view.suggestion?.habit.id).toBe('lift');
    expect(view.suggestion?.situation).toBe('debtComfortable');
    expect(view.suggestion?.owed).toBe(3);
    expect(view.suggestion?.daysLeft).toBe(6);
  });

  it('switches to the run once the lift debt is cleared', () => {
    const logs: HabitLogMap = {
      '2026-09-14': { lift: true }, '2026-09-15': { lift: true }, '2026-09-16': { lift: true },
    };
    expect(getTodayView(tuesday(), logs).suggestion?.habit.id).toBe('run');
  });

  it('falls back to an undone daily habit when the week is clear', () => {
    const logs: HabitLogMap = {
      '2026-09-14': { lift: true, run: true }, '2026-09-15': { lift: true }, '2026-09-16': { lift: true },
    };
    const view = getTodayView(tuesday(), logs);
    expect(view.suggestion?.habit.id).toBe('walk');
    expect(view.suggestion?.situation).toBe('dailyOpen');
  });

  it('suggests nothing when everything is settled', () => {
    weighIn('2026-09-15');
    const logs: HabitLogMap = {
      '2026-09-14': { lift: true, run: true },
      '2026-09-15': { lift: true, walk: true, dog: true, dry: true },
      '2026-09-16': { lift: true },
    };
    expect(getTodayView(tuesday(), logs).suggestion).toBeNull();
  });

  it('suggests nothing on a rest day', () => {
    localStorage.setItem('rest_days', JSON.stringify(['2026-09-15']));
    const view = getTodayView(tuesday(), {});
    expect(view.isRest).toBe(true);
    expect(view.suggestion).toBeNull();
  });

  it('still scores the daily habits on a rest day', () => {
    localStorage.setItem('rest_days', JSON.stringify(['2026-09-15']));
    const view = getTodayView(tuesday(), { '2026-09-15': { walk: true } });
    expect([view.total, view.completed]).toEqual([4, 1]);
  });
});
