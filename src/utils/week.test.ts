import { describe, it, expect } from 'vitest';
import { startOfWeek, endOfWeek, daysLeftInWeek } from './week';

// 2026-09-15 is a Tuesday. Its week is Mon 14 Sept to Sun 20 Sept.
const tuesday = () => new Date(2026, 8, 15, 13, 30, 0);

describe('startOfWeek', () => {
  it('returns the Monday of the containing week at local midnight', () => {
    const d = startOfWeek(tuesday());
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 14, 0]);
  });

  it('treats Sunday as the last day of the week, not the first', () => {
    expect(startOfWeek(new Date(2026, 8, 20, 9, 0, 0)).getDate()).toBe(14);
  });

  it('returns the same day when given a Monday', () => {
    const d = startOfWeek(new Date(2026, 8, 14, 23, 59, 0));
    expect([d.getDate(), d.getHours()]).toEqual([14, 0]);
  });

  it('does not mutate its argument', () => {
    const input = tuesday();
    startOfWeek(input);
    expect([input.getDate(), input.getHours()]).toEqual([15, 13]);
  });
});

describe('endOfWeek', () => {
  it('returns the following Monday at local midnight, as an exclusive bound', () => {
    const d = endOfWeek(tuesday());
    expect([d.getDate(), d.getHours()]).toEqual([21, 0]);
  });

  it('is exactly seven days after startOfWeek', () => {
    const ms = endOfWeek(tuesday()).getTime() - startOfWeek(tuesday()).getTime();
    expect(Math.round(ms / 86400000)).toBe(7);
  });
});

describe('daysLeftInWeek', () => {
  it('counts today through Sunday inclusive', () => {
    expect(daysLeftInWeek(new Date(2026, 8, 14))).toBe(7); // Monday
    expect(daysLeftInWeek(new Date(2026, 8, 15))).toBe(6); // Tuesday
    expect(daysLeftInWeek(new Date(2026, 8, 19))).toBe(2); // Saturday
    expect(daysLeftInWeek(new Date(2026, 8, 20))).toBe(1); // Sunday
  });

  it('ignores the time of day', () => {
    expect(daysLeftInWeek(new Date(2026, 8, 20, 23, 59, 59))).toBe(1);
  });
});
