import { describe, it, expect, beforeEach } from 'vitest';
import {
  dayCompletion, formatWeekRange, weekVerdict,
  getWeekReview, getMonthCompletion, getYearCompletion, trackingStartedOn,
} from './insights';
import type { HabitBar } from './insights';
import type { HabitLogMap } from '../types/habits';
import { loadHabits } from './habits';

// Wednesday 16 September 2026. Week is Mon 14 to Sun 20.
const wednesday = () => new Date(2026, 8, 16, 12, 0, 0);
const bar = (id: string, done: number, target: number): HabitBar =>
  ({ habit: loadHabits().find(h => h.id === id)!, done, target });

beforeEach(() => { localStorage.clear(); });

describe('dayCompletion', () => {
  it('counts the held dry day on an untouched day', () => {
    expect(dayCompletion('2026-09-16', {})).toBeCloseTo(1 / 3);
  });

  it('is 1 when every daily habit is done', () => {
    expect(dayCompletion('2026-09-16', { '2026-09-16': { walk: true, dog: true } })).toBe(1);
  });

  it('is 0 when the dry day is broken and nothing else is done', () => {
    expect(dayCompletion('2026-09-16', { '2026-09-16': { dry: false } })).toBe(0);
  });

  it('ignores weekly habits', () => {
    expect(dayCompletion('2026-09-16', { '2026-09-16': { lift: true, run: true } })).toBeCloseTo(1 / 3);
  });
});

describe('formatWeekRange', () => {
  it('names one month once', () => {
    expect(formatWeekRange(wednesday())).toBe('14–20 September');
  });

  it('names both months when the week straddles them', () => {
    // Wed 30 September 2026: week is Mon 28 Sept to Sun 4 Oct.
    expect(formatWeekRange(new Date(2026, 8, 30))).toBe('28 September – 4 October');
  });
});

describe('weekVerdict', () => {
  it('says nothing is owed when every bar is full', () => {
    expect(weekVerdict(3, 3, [bar('walk', 7, 7), bar('lift', 3, 3)]))
      .toBe('All 3 closed. Nothing owed.');
  });

  it('names the habit with nothing logged at all', () => {
    expect(weekVerdict(2, 3, [bar('walk', 6, 7), bar('run', 0, 1)]))
      .toBe('2 of 3 closed. No run yet.');
  });

  it('names the worst proportional gap when everything has started', () => {
    expect(weekVerdict(2, 3, [bar('walk', 6, 7), bar('lift', 1, 3)]))
      .toBe('2 of 3 closed. Lift is the gap.');
  });

  it('handles a week that has not begun', () => {
    expect(weekVerdict(0, 0, [])).toBe('The week has not started.');
  });
});

describe('getWeekReview', () => {
  it('counts only days that have happened', () => {
    // Mon, Tue, Wed. Thursday onward has not happened yet.
    const review = getWeekReview(wednesday(), {});
    expect(review.daysCounted).toBe(3);
  });

  it('counts a fully closed day', () => {
    const logs: HabitLogMap = {
      '2026-09-14': { walk: true, dog: true },
      '2026-09-15': { walk: true },
    };
    const review = getWeekReview(wednesday(), logs);
    expect(review.daysClosed).toBe(1);
  });

  it('gives every habit a bar with the right target', () => {
    const review = getWeekReview(wednesday(), {});
    const targets = Object.fromEntries(review.bars.map(b => [b.habit.id, b.target]));
    expect(targets).toEqual({ walk: 7, dog: 7, dry: 5, lift: 3, run: 1 });
  });

  it('never reports more done than the target', () => {
    // The dry day is held all seven days but its target is five.
    const dry = getWeekReview(wednesday(), {}).bars.find(b => b.habit.id === 'dry')!;
    expect(dry.done).toBe(5);
  });

  it('labels the week Monday to Sunday', () => {
    expect(getWeekReview(wednesday(), {}).rangeLabel).toBe('14–20 September');
  });
});

describe('getMonthCompletion', () => {
  it('returns every day of the month', () => {
    expect(getMonthCompletion(wednesday(), {}).length).toBe(30); // September
  });

  it('marks days after today as future and scores them zero', () => {
    const days = getMonthCompletion(wednesday(), {});
    const d20 = days.find(d => d.dayOfMonth === 20)!;
    expect(d20.isFuture).toBe(true);
    expect(d20.completion).toBe(0);
  });

  it('scores days that have happened', () => {
    const days = getMonthCompletion(wednesday(), { '2026-09-15': { walk: true, dog: true } });
    expect(days.find(d => d.dayOfMonth === 15)!.completion).toBe(1);
  });

  it('marks today', () => {
    const today = getMonthCompletion(wednesday(), {}).filter(d => d.isToday);
    expect(today.map(d => d.dayOfMonth)).toEqual([16]);
  });

  it('marks rest days', () => {
    localStorage.setItem('rest_days', JSON.stringify(['2026-09-15']));
    expect(getMonthCompletion(wednesday(), {}).find(d => d.dayOfMonth === 15)!.isRest).toBe(true);
  });
});

describe('getYearCompletion', () => {
  it('covers the whole calendar year', () => {
    expect(getYearCompletion(wednesday(), {}).length).toBe(365); // 2026 is not a leap year
  });

  it('starts on 1 January and ends on 31 December', () => {
    const days = getYearCompletion(wednesday(), {});
    expect(days[0].dateStr).toBe('2026-01-01');
    expect(days[days.length - 1].dateStr).toBe('2026-12-31');
  });
});

describe('untracked history', () => {
  it('treats every day as untracked when nothing was ever logged', () => {
    const days = getMonthCompletion(wednesday(), {});
    expect(days.every(d => d.isUntracked)).toBe(true);
    expect(days.every(d => d.completion === 0)).toBe(true);
  });

  it('marks days before the first log as untracked', () => {
    // The held dry day would otherwise score every day back to January at a
    // third, washing the year grid in pale green.
    const logs: HabitLogMap = { '2026-09-14': { walk: true } };
    const days = getMonthCompletion(wednesday(), logs);
    expect(days.find(d => d.dayOfMonth === 1)!.isUntracked).toBe(true);
    expect(days.find(d => d.dayOfMonth === 1)!.completion).toBe(0);
    expect(days.find(d => d.dayOfMonth === 14)!.isUntracked).toBe(false);
  });

  it('scores tracked days normally', () => {
    const logs: HabitLogMap = { '2026-09-14': { walk: true, dog: true } };
    expect(getMonthCompletion(wednesday(), logs).find(d => d.dayOfMonth === 14)!.completion).toBe(1);
  });

  it('ignores a date whose entry is empty', () => {
    const logs: HabitLogMap = { '2026-09-01': {}, '2026-09-14': { walk: true } };
    expect(trackingStartedOn(logs)).toBe('2026-09-14');
  });

  it('applies to the year grid too', () => {
    const logs: HabitLogMap = { '2026-09-14': { walk: true } };
    const year = getYearCompletion(wednesday(), logs);
    expect(year.find(d => d.dateStr === '2026-03-01')!.isUntracked).toBe(true);
    expect(year.find(d => d.dateStr === '2026-09-14')!.isUntracked).toBe(false);
  });
});
