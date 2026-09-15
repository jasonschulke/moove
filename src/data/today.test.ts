import { describe, it, expect, beforeEach } from 'vitest';
import { getTodayView, suggestionReason } from './today';
import type { HabitLogMap } from '../types/habits';

// Tuesday 15 September 2026. Week is Mon 14 to Sun 20: six days left counting today.
const tuesday = () => new Date(2026, 8, 15, 12, 0, 0);

beforeEach(() => { localStorage.clear(); });

describe('suggestionReason', () => {
  it('names the last day of the week', () => {
    expect(suggestionReason(1, 1)).toBe('Last day of the week');
    expect(suggestionReason(3, 1)).toBe('Last day of the week');
  });

  it('says every remaining day when the debt fills the week', () => {
    expect(suggestionReason(3, 3)).toBe('Every remaining day');
    expect(suggestionReason(4, 3)).toBe('Every remaining day');
  });

  it('otherwise gives the count and the room left', () => {
    expect(suggestionReason(2, 6)).toBe('2 left, 6 days');
    expect(suggestionReason(1, 4)).toBe('1 left, 4 days');
  });
});

describe('getTodayView', () => {
  it('has a denominator of three, always', () => {
    expect(getTodayView(tuesday(), {}).total).toBe(3);
  });

  it('counts the held dry day as already complete on an empty day', () => {
    expect(getTodayView(tuesday(), {}).completed).toBe(1);
  });

  it('counts each logged daily habit', () => {
    const logs: HabitLogMap = { '2026-09-15': { walk: true, dog: true } };
    expect(getTodayView(tuesday(), logs).completed).toBe(3);
  });

  it('drops the score when the dry day is broken', () => {
    const logs: HabitLogMap = { '2026-09-15': { walk: true, dog: true, dry: false } };
    expect(getTodayView(tuesday(), logs).completed).toBe(2);
  });

  it('never counts lift or run toward the day score', () => {
    const view = getTodayView(tuesday(), { '2026-09-15': { lift: true, run: true } });
    expect(view.completed).toBe(1); // the held dry day only
    expect(view.total).toBe(3);
  });

  it('reports the day of the month', () => {
    expect(getTodayView(tuesday(), {}).dayOfMonth).toBe(15);
  });

  it('returns a status for all five habits, in order', () => {
    expect(getTodayView(tuesday(), {}).statuses.map(s => s.habit.id))
      .toEqual(['walk', 'dog', 'dry', 'lift', 'run']);
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
    expect(view.suggestion?.reason).toBe('3 left, 6 days');
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
    expect(view.suggestion?.reason).toBe('Still open today');
  });

  it('suggests nothing when everything is settled', () => {
    const logs: HabitLogMap = {
      '2026-09-14': { lift: true, run: true },
      '2026-09-15': { lift: true, walk: true, dog: true },
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
    expect([view.total, view.completed]).toEqual([3, 2]);
  });
});
