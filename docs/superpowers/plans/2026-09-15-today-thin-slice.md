# Today Thin Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Today screen to Moove — a completion ring, one suggested focus with a reason, and a one-tap list of the five tracked habits — backed by a habits data model, without disturbing anything the app already does.

**Architecture:** Three new pure modules under `src/data` and `src/utils` (week boundaries, habit persistence, the Today engine), two new presentational pieces, one new page, and a new tab in the existing nav. The old Home tab stays. Storage is localStorage only in this slice — no Supabase table, no migration to run. Every decision that involves arithmetic (what is owed, how many days are left, what to suggest) lives in a pure function with tests; the page only renders.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4, Vitest + jsdom.

## Global Constraints

- Weeks run **Monday to Sunday**, everywhere. Local time, not UTC.
- The app **never assigns a habit to a particular day**. Nothing in the UI names a day of the week as a target.
- The completion ring counts **daily habits only**, so its denominator is **always 3**. Weekly habits (lift, run) are debt shown on their own rows, never in the ring.
- Existing behaviour must not change. Home, Workout, Library, Coach and Settings keep working exactly as they do now.
- **No Supabase changes.** Habit data is localStorage only in this slice.
- Colours, verbatim: paper `#faf7f2`, ink `#14110d`, green `#047857`, ring track `#ece7dd`, card white `#ffffff` at `18px` radius, muted `#8c8478`, faint `#a89f90`, hairline `#e5dfd4`.
- Card shadow, verbatim: `0 1px 2px rgba(20,17,13,0.05), 0 10px 26px -14px rgba(20,17,13,0.22)`.
- The serif is **Newsreader** and does exactly **two** jobs on Today: the ring fraction and the suggestion name. System sans does everything else.
- Green appears only as the ring and progress. Nowhere else.
- Test command is `npm test`. Typecheck and build are `npm run build`. Lint is `npm run lint`.
- Commit after every task. Branch: `feat/today-slice`.

## Note on one spec inconsistency

`claude/product-direction.md` says both "the ring is out of 3" and "a rest day has a smaller denominator". These contradict. The second predates the no-scheduling decision; with nothing assigned to a day, only daily habits can be due, so the denominator is 3 every day including rest days. **This plan implements a constant denominator of 3.** A rest day's only effect on Today is that it suppresses the suggestion.

---

### Task 1: Monday-to-Sunday week boundaries

Every cadence number depends on this, and `getWorkoutStats` currently counts a rolling seven days. Fix the primitive first, then the caller.

**Files:**
- Create: `src/utils/week.ts`
- Create: `src/utils/week.test.ts`
- Modify: `src/data/stats.ts` (the `thisWeek` calculation inside `getWorkoutStats`, around line 140)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `startOfWeek(date: Date): Date` — local midnight on the Monday of that date's week.
  - `endOfWeek(date: Date): Date` — local midnight on the Monday **after** that week; an exclusive upper bound.
  - `daysLeftInWeek(date: Date): number` — days from `date` through Sunday inclusive. Monday 7, Sunday 1.

- [ ] **Step 1: Write the failing tests** in `src/utils/week.test.ts`

```ts
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
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- src/utils/week.test.ts`. Expected: `Failed to resolve import "./week"`.

- [ ] **Step 3: Write `src/utils/week.ts`**

```ts
/**
 * Week boundaries, Monday to Sunday, in local time.
 *
 * Every cadence number in the app is measured against these. JavaScript's
 * getDay() treats Sunday as 0, which is the wrong end of the week for us, so
 * every function here remaps it first.
 */

/** Days since the Monday of this date's week. Monday 0 ... Sunday 6. */
function dayOffset(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Local midnight on the Monday of the given date's week. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - dayOffset(d));
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Local midnight on the Monday after the given date's week.
 * Exclusive upper bound: t is in the week when startOfWeek <= t < endOfWeek.
 */
export function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 7);
  return d;
}

/** Days from the given date through Sunday, inclusive. Monday 7 ... Sunday 1. */
export function daysLeftInWeek(date: Date): number {
  return 7 - dayOffset(date);
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- src/utils/week.test.ts`. Expected: PASS, 8 tests.

- [ ] **Step 5: Write the failing test for the `getWorkoutStats` fix**, appended to `src/data/stats.test.ts`. Ensure `vi` is in the vitest import and `getWorkoutStats` is imported from `./stats`.

```ts
describe('getWorkoutStats thisWeek', () => {
  it('counts from Monday, not a rolling seven days', () => {
    vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0)); // Tuesday; week is Mon 14 to Sun 20
    const session = (id: string, day: number) => ({
      id, name: id, blocks: [], exercises: [],
      startedAt: new Date(2026, 8, day, 10, 0, 0).toISOString(),
      completedAt: new Date(2026, 8, day, 11, 0, 0).toISOString(),
    });
    localStorage.setItem('workout_sessions', JSON.stringify([
      session('a', 13), // Sunday, last week: inside a rolling 7 days, outside this week
      session('b', 14), // Monday, this week
      session('c', 15), // today
    ]));
    expect(getWorkoutStats().thisWeek).toBe(2);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 6: Run to verify it fails** — expected `expected 3 to be 2`, because the rolling window reaches back to the 8th and picks up Sunday the 13th.

- [ ] **Step 7: Fix `getWorkoutStats`.** Add `import { startOfWeek } from '../utils/week';` to `src/data/stats.ts`. Replace the two `oneWeekAgo` lines with `const weekStart = startOfWeek(now);` and change the filter to `new Date(s.startedAt) >= weekStart`. Leave `oneMonthAgo` and `thisMonth` alone.

- [ ] **Step 8: Run the full suite** — `npm test`. Expected: the 38 existing tests plus the 9 added here.

- [ ] **Step 9: Commit**

```bash
git add src/utils/week.ts src/utils/week.test.ts src/data/stats.ts src/data/stats.test.ts
git commit -m "Count weeks Monday to Sunday instead of a rolling seven days"
```

---

### Task 2: The habit model and its storage

**Files:**
- Create: `src/types/habits.ts`
- Create: `src/data/habits.ts`
- Create: `src/data/habits.test.ts`

**Interfaces:**
- Consumes: `startOfWeek`, `endOfWeek` from `src/utils/week.ts`; `formatLocalDate` from `src/data/storage.ts`.
- Produces:
  - `type HabitCadence = { kind: 'daily' } | { kind: 'daily-quota'; perWeek: number } | { kind: 'weekly'; perWeek: number }`
  - `interface Habit { id: string; name: string; cadence: HabitCadence; heldByDefault: boolean; order: number }`
  - `type HabitLogMap = Record<string, Record<string, boolean>>` — date `YYYY-MM-DD` to habit id to done.
  - `const HABITS: Habit[]`, `dailyHabits(): Habit[]`, `weeklyHabits(): Habit[]`
  - `loadHabitLogs(): HabitLogMap`, `saveHabitLogs(logs: HabitLogMap): void`
  - `isHabitDone(habit: Habit, dateStr: string, logs: HabitLogMap): boolean`
  - `setHabitDone(habitId: string, dateStr: string, done: boolean): HabitLogMap`
  - `toggleHabit(habit: Habit, dateStr: string): HabitLogMap`
  - `countDoneInWeek(habit: Habit, date: Date, logs: HabitLogMap): number`

- [ ] **Step 1: Write `src/types/habits.ts`**

```ts
/**
 * Habit tracking.
 *
 * Five things are tracked. Three are daily and make up the day's completion
 * score; two are weekly commitments carried as debt across the week. Nothing
 * is ever assigned to a particular day.
 */

export type HabitCadence =
  /** Due every day. Counts toward the day's completion score. */
  | { kind: 'daily' }
  /** A daily state with a weekly quota, e.g. dry on 5 of 7 days. Counts toward the day's score. */
  | { kind: 'daily-quota'; perWeek: number }
  /** Owed a number of times per week, on no particular day. Not in the day score. */
  | { kind: 'weekly'; perWeek: number };

export interface Habit {
  id: string;
  name: string;
  cadence: HabitCadence;
  /**
   * True for inverted habits: the day starts complete and is broken by
   * tapping. A dry day is dry until you say otherwise. A per-habit flag
   * rather than a special case, so a second inverted habit needs no new code.
   */
  heldByDefault: boolean;
  order: number;
}

/** date (YYYY-MM-DD) -> habit id -> done. Absent means "use the habit's default". */
export type HabitLogMap = Record<string, Record<string, boolean>>;
```

- [ ] **Step 2: Write the failing tests** in `src/data/habits.test.ts`

```ts
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
```

- [ ] **Step 3: Run to verify it fails** — `npm test -- src/data/habits.test.ts`. Expected: `Failed to resolve import "./habits"`.

- [ ] **Step 4: Write `src/data/habits.ts`**

```ts
/**
 * The five tracked habits and their day-by-day log.
 *
 * Hardcoded for now. Library gains add/edit/delete later; nothing here assumes
 * the list is fixed beyond the exported constant, so that change is additive.
 *
 * localStorage only in this slice. No Supabase table, so nothing to migrate.
 */

import type { Habit, HabitLogMap } from '../types/habits';
import { startOfWeek, endOfWeek } from '../utils/week';
import { formatLocalDate } from './storage';

const HABIT_LOGS_KEY = 'habit_logs';

export const HABITS: Habit[] = [
  { id: 'walk', name: 'Walk',         cadence: { kind: 'daily' },                   heldByDefault: false, order: 0 },
  { id: 'dog',  name: 'Walk the dog', cadence: { kind: 'daily' },                   heldByDefault: false, order: 1 },
  { id: 'dry',  name: 'Dry day',      cadence: { kind: 'daily-quota', perWeek: 5 }, heldByDefault: true,  order: 2 },
  { id: 'lift', name: 'Lift',         cadence: { kind: 'weekly', perWeek: 3 },      heldByDefault: false, order: 3 },
  { id: 'run',  name: 'Run',          cadence: { kind: 'weekly', perWeek: 1 },      heldByDefault: false, order: 4 },
];

/** The habits that make up a day's completion score. Always three. */
export function dailyHabits(): Habit[] {
  return HABITS.filter(h => h.cadence.kind !== 'weekly');
}

/** The habits owed a number of times per week, on no particular day. */
export function weeklyHabits(): Habit[] {
  return HABITS.filter(h => h.cadence.kind === 'weekly');
}

export function loadHabitLogs(): HabitLogMap {
  try {
    const raw = localStorage.getItem(HABIT_LOGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as HabitLogMap) : {};
  } catch {
    return {};
  }
}

export function saveHabitLogs(logs: HabitLogMap): void {
  localStorage.setItem(HABIT_LOGS_KEY, JSON.stringify(logs));
}

/**
 * Whether a habit counts as done on a date. An absent entry means the habit's
 * default, which is true only for inverted habits like the dry day.
 */
export function isHabitDone(habit: Habit, dateStr: string, logs: HabitLogMap): boolean {
  const explicit = logs[dateStr]?.[habit.id];
  return explicit === undefined ? habit.heldByDefault : explicit;
}

/** Write one habit's state for one date. Returns the updated map. */
export function setHabitDone(habitId: string, dateStr: string, done: boolean): HabitLogMap {
  const logs = loadHabitLogs();
  const next: HabitLogMap = { ...logs, [dateStr]: { ...(logs[dateStr] ?? {}), [habitId]: done } };
  saveHabitLogs(next);
  return next;
}

/** Flip a habit's state for one date. Returns the updated map. */
export function toggleHabit(habit: Habit, dateStr: string): HabitLogMap {
  const current = isHabitDone(habit, dateStr, loadHabitLogs());
  return setHabitDone(habit.id, dateStr, !current);
}

/**
 * How many days in the containing Monday-to-Sunday week the habit was done.
 * Counts the whole week, future days included, because an inverted habit is
 * held on days that have not happened yet and its quota is a weekly budget.
 */
export function countDoneInWeek(habit: Habit, date: Date, logs: HabitLogMap): number {
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  let count = 0;
  for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    if (isHabitDone(habit, formatLocalDate(d), logs)) count++;
  }
  return count;
}
```

- [ ] **Step 5: Run to verify it passes** — `npm test -- src/data/habits.test.ts`. Expected: PASS, 17 tests.

- [ ] **Step 6: Commit**

```bash
git add src/types/habits.ts src/data/habits.ts src/data/habits.test.ts
git commit -m "Add the habit model and its day-by-day log"
```

---

### Task 3: The Today engine

The whole of Today's judgement lives here as pure functions so it can be tested without a browser. The page renders what this returns and decides nothing.

**Files:**
- Create: `src/data/today.ts`
- Create: `src/data/today.test.ts`

**Interfaces:**
- Consumes: `HABITS`, `dailyHabits`, `weeklyHabits`, `isHabitDone`, `countDoneInWeek`, `loadHabitLogs` from `src/data/habits.ts`; `daysLeftInWeek` from `src/utils/week.ts`; `formatLocalDate`, `isRestDay` from `src/data/storage.ts`.
- Produces:
  - `interface HabitStatus { habit: Habit; done: boolean; owed: number; perWeek: number; doneThisWeek: number }`
  - `interface Suggestion { habit: Habit; reason: string }`
  - `interface TodayView { dateStr: string; dayOfMonth: number; isRest: boolean; completed: number; total: number; statuses: HabitStatus[]; suggestion: Suggestion | null }`
  - `getTodayView(now?: Date, logs?: HabitLogMap): TodayView`
  - `suggestionReason(owed: number, daysLeft: number): string`

- [ ] **Step 1: Write the failing tests** in `src/data/today.test.ts`

```ts
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
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- src/data/today.test.ts`. Expected: `Failed to resolve import "./today"`.

- [ ] **Step 3: Write `src/data/today.ts`**

```ts
/**
 * What today looks like.
 *
 * Every judgement Today makes is here, as pure functions over a date and a log
 * map, so it can be tested without a browser. The page renders what this
 * returns and decides nothing.
 */

import type { Habit, HabitLogMap } from '../types/habits';
import { HABITS, dailyHabits, weeklyHabits, isHabitDone, countDoneInWeek, loadHabitLogs } from './habits';
import { daysLeftInWeek } from '../utils/week';
import { formatLocalDate, isRestDay } from './storage';

export interface HabitStatus {
  habit: Habit;
  /** Done today. */
  done: boolean;
  /** Times still owed this week. Zero for habits with no weekly quota. */
  owed: number;
  /** The weekly target, or 0 for a plain daily habit. */
  perWeek: number;
  doneThisWeek: number;
}

export interface Suggestion {
  habit: Habit;
  /**
   * Why this one. Load-bearing: without it the suggestion is arbitrary and
   * gets overridden every time.
   */
  reason: string;
}

export interface TodayView {
  dateStr: string;
  dayOfMonth: number;
  isRest: boolean;
  /** Daily habits done today. */
  completed: number;
  /** Always 3. Daily habits only, so the denominator never moves. */
  total: number;
  statuses: HabitStatus[];
  suggestion: Suggestion | null;
}

/** The line under the suggestion. Three shapes, no more. */
export function suggestionReason(owed: number, daysLeft: number): string {
  if (daysLeft <= 1) return 'Last day of the week';
  if (owed >= daysLeft) return 'Every remaining day';
  return `${owed} left, ${daysLeft} days`;
}

function weeklyTarget(habit: Habit): number {
  return habit.cadence.kind === 'weekly' ? habit.cadence.perWeek : 0;
}

export function getTodayView(now: Date = new Date(), logs?: HabitLogMap): TodayView {
  const log = logs ?? loadHabitLogs();
  const dateStr = formatLocalDate(now);
  const daysLeft = daysLeftInWeek(now);

  const statuses: HabitStatus[] = HABITS.map(habit => {
    const doneThisWeek = countDoneInWeek(habit, now, log);
    const perWeek = weeklyTarget(habit);
    return {
      habit,
      done: isHabitDone(habit, dateStr, log),
      perWeek,
      doneThisWeek,
      owed: Math.max(0, perWeek - doneThisWeek),
    };
  });

  const daily = dailyHabits();
  const completed = daily.filter(h => isHabitDone(h, dateStr, log)).length;
  const isRest = isRestDay(dateStr);

  return {
    dateStr,
    dayOfMonth: now.getDate(),
    isRest,
    completed,
    total: daily.length,
    statuses,
    // A rest day is a decision already made. Suggesting work would undo it.
    suggestion: isRest ? null : pickSuggestion(statuses, daysLeft),
  };
}

/**
 * The weekly habit under the most pressure, measured as debt per remaining
 * day. Falls back to the first undone daily habit, then to nothing.
 */
function pickSuggestion(statuses: HabitStatus[], daysLeft: number): Suggestion | null {
  const weeklyIds = new Set(weeklyHabits().map(h => h.id));
  const owing = statuses
    .filter(s => weeklyIds.has(s.habit.id) && s.owed > 0)
    .sort((a, b) => (b.owed / daysLeft) - (a.owed / daysLeft) || a.habit.order - b.habit.order);

  if (owing.length > 0) {
    return { habit: owing[0].habit, reason: suggestionReason(owing[0].owed, daysLeft) };
  }

  const dailyIds = new Set(dailyHabits().map(h => h.id));
  const openDaily = statuses.find(s => dailyIds.has(s.habit.id) && !s.done);
  if (openDaily) return { habit: openDaily.habit, reason: 'Still open today' };

  return null;
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- src/data/today.test.ts`. Expected: PASS, 17 tests.
- [ ] **Step 5: Run the whole suite** — `npm test`. Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add src/data/today.ts src/data/today.test.ts
git commit -m "Add the Today engine: day score, weekly debt, one suggestion"
```

---

### Task 4: The visual system

Scoped to Today. The rest of the app keeps its slate palette untouched.

**Files:**
- Modify: `index.html` — add the Newsreader stylesheet link after the Material Symbols link
- Modify: `src/index.css` — append the Today tokens and helper classes

**Interfaces:**
- Produces: CSS classes `today-paper`, `today-card`, `today-serif`, `today-caps`, `today-rule`, `today-rise` and the custom properties they use.

- [ ] **Step 1: Add the typeface.** In `index.html`, directly after the Material Symbols link, add:

```html
    <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Append to `src/index.css`**

```css
/* ==========================================================================
   Today
   Scoped to the Today screen. The rest of the app keeps its slate palette.
   ========================================================================== */

:root {
  --today-paper: #faf7f2;
  --today-ink: #14110d;
  --today-green: #047857;
  --today-track: #ece7dd;
  --today-muted: #8c8478;
  --today-faint: #a89f90;
  --today-hairline: #e5dfd4;
}

.today-paper { background: var(--today-paper); color: var(--today-ink); }

.today-card {
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(20, 17, 13, 0.05), 0 10px 26px -14px rgba(20, 17, 13, 0.22);
}

/* The serif is the voice. Exactly two jobs on Today: the ring fraction and
   the suggestion name. */
.today-serif { font-family: 'Newsreader', Georgia, serif; }

.today-caps {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--today-muted);
}

.today-rule { height: 2px; background: var(--today-ink); }

/* Motion is a settle on load, not a permanent effect. */
.today-rise { animation: today-rise-in 0.55s cubic-bezier(0.16, 0.8, 0.3, 1) both; }

@keyframes today-rise-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .today-rise { animation: none; }
}
```

- [ ] **Step 3: Verify the build compiles** — `npm run build`.
- [ ] **Step 4: Commit**

```bash
git add index.html src/index.css
git commit -m "Add the Today visual system: warm paper, ink structure, Newsreader"
```

---

### Task 5: The completion ring

**Files:** Create `src/components/CompletionRing.tsx`

**Interfaces:**
- Produces: `CompletionRing({ completed, total, size }: { completed: number; total: number; size?: number })`.
- The root element carries `role="img"` and `aria-label={`${completed} of ${total} done today`}`. Task 8's smoke test asserts on that label, so the wording is part of the contract.

- [ ] **Step 1: Write `src/components/CompletionRing.tsx`**

```tsx
/**
 * The day's completion, as one arc.
 *
 * A single score rather than per-habit segments, so adding a fourth tracked
 * thing later does not mean redesigning the calendar that reuses this shape.
 */

interface CompletionRingProps {
  completed: number;
  total: number;
  /** Outer diameter in px. */
  size?: number;
}

export function CompletionRing({ completed, total, size = 128 }: CompletionRingProps) {
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0;
  const offset = circumference * (1 - fraction);

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${completed} of ${total} done today`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="var(--today-track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="var(--today-green)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 0.8, 0.3, 1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="today-serif leading-none"
          style={{ fontSize: size * 0.3, color: 'var(--today-ink)' }}>
          {completed}<span style={{ color: 'var(--today-faint)' }}>/{total}</span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles** — `npm run build`.
- [ ] **Step 3: Commit**

```bash
git add src/components/CompletionRing.tsx
git commit -m "Add the completion ring"
```

---

### Task 6: The Today page

Top to bottom: the day of the month and the month name, a black rule, the ring card, the suggestion card (or the rest card), the five habit rows, then a rest-day toggle. Nothing is editable here — the only actions are log, unlog, and rest.

**Files:** Create `src/pages/TodayPage.tsx`

**Interfaces:**
- Consumes: `getTodayView` and the `HabitStatus` type from `src/data/today.ts`; `toggleHabit` from `src/data/habits.ts`; `toggleRestDay` from `src/data/storage.ts`; `CompletionRing` from `src/components/CompletionRing.tsx`.
- Produces: `TodayPage()`.
- Each habit row is a `<button>` whose accessible name is exactly the habit name (`Walk`, `Walk the dog`, `Dry day`, `Lift`, `Run`) and which carries `aria-pressed`. Task 8's smoke test clicks by that name.

- [ ] **Step 1: Write `src/pages/TodayPage.tsx`**

```tsx
/**
 * Today.
 *
 * One question: what can I do today. The ring says how much of the day is
 * closed, the suggestion says what to do next and why, and the list lets that
 * be overridden. Nothing here is editable; habits are configured in Library.
 */

import { useCallback, useEffect, useState } from 'react';
import { getTodayView } from '../data/today';
import type { HabitStatus } from '../data/today';
import { toggleHabit } from '../data/habits';
import { toggleRestDay } from '../data/storage';
import { CompletionRing } from '../components/CompletionRing';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function CheckMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function HabitRow({ status, onToggle }: { status: HabitStatus; onToggle: () => void }) {
  const { habit, done, owed, perWeek, doneThisWeek } = status;

  // Weekly habits carry their debt on the row. Daily ones say nothing extra;
  // the ring already speaks for them.
  const detail = perWeek > 0 ? `${doneThisWeek} of ${perWeek} this week` : null;

  return (
    <button
      onClick={onToggle}
      aria-pressed={done}
      className="today-card w-full flex items-center gap-3 px-4 py-3.5 text-left active:scale-[0.99] transition-transform"
    >
      <span className="flex items-center justify-center flex-shrink-0 rounded-full transition-colors"
        style={{
          width: 26, height: 26,
          background: done ? 'var(--today-green)' : 'transparent',
          border: done ? 'none' : '1.8px solid var(--today-track)',
        }}>
        {done && <CheckMark />}
      </span>

      <span className="flex-grow min-w-0 text-[15px]"
        style={{ color: 'var(--today-ink)', opacity: done ? 0.45 : 1 }}>
        {habit.name}
      </span>

      {detail && (
        <span className="today-caps flex-shrink-0"
          style={{ color: owed > 0 ? 'var(--today-ink)' : 'var(--today-muted)' }}>
          {detail}
        </span>
      )}
    </button>
  );
}

export function TodayPage() {
  const [view, setView] = useState(() => getTodayView());
  const refresh = useCallback(() => setView(getTodayView()), []);

  // Recompute when the tab comes back into view, so a phone left open
  // overnight does not keep showing yesterday.
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const handleToggle = (status: HabitStatus) => {
    toggleHabit(status.habit, view.dateStr);
    refresh();
  };

  const handleToggleRest = () => {
    toggleRestDay(view.dateStr);
    refresh();
  };

  const monthName = MONTHS[new Date().getMonth()];

  return (
    <div className="today-paper min-h-screen pb-24">
      <div className="max-w-lg mx-auto">

        <header className="px-5 pt-12 pb-3 flex items-baseline justify-between">
          <span className="text-[26px] font-semibold tracking-tight" style={{ color: 'var(--today-ink)' }}>
            {view.dayOfMonth}
          </span>
          <span className="today-caps">{monthName}</span>
        </header>
        <div className="today-rule mx-5" />

        <section className="px-4 pt-6 today-rise">
          <div className="today-card flex items-center gap-5 p-5">
            <CompletionRing completed={view.completed} total={view.total} size={104} />
            <div className="min-w-0">
              <div className="today-caps mb-1.5">Today</div>
              <div className="text-[14px] leading-snug" style={{ color: 'var(--today-muted)' }}>
                {view.completed === view.total
                  ? 'The day is closed.'
                  : `${view.total - view.completed} still open.`}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pt-4 today-rise">
          <div className="today-card p-5">
            <div className="today-caps mb-2">{view.isRest ? 'Rest day' : 'Next'}</div>
            {view.isRest ? (
              <div className="today-serif text-[24px] leading-snug" style={{ color: 'var(--today-ink)' }}>
                Nothing owed.
              </div>
            ) : view.suggestion ? (
              <>
                <div className="today-serif text-[26px] leading-tight mb-1" style={{ color: 'var(--today-ink)' }}>
                  {view.suggestion.habit.name}
                </div>
                <div className="text-[13.5px]" style={{ color: 'var(--today-muted)' }}>
                  {view.suggestion.reason}
                </div>
              </>
            ) : (
              <div className="today-serif text-[26px] leading-tight" style={{ color: 'var(--today-ink)' }}>
                Nothing left.
              </div>
            )}
          </div>
        </section>

        <section className="px-4 pt-5 flex flex-col gap-2 today-rise">
          {view.statuses.map(status => (
            <HabitRow key={status.habit.id} status={status} onToggle={() => handleToggle(status)} />
          ))}
        </section>

        <div className="px-4 pt-5">
          <button onClick={handleToggleRest}
            className="w-full h-11 rounded-[13px] text-[13px] font-medium transition-colors"
            style={{
              background: view.isRest ? 'var(--today-ink)' : 'transparent',
              color: view.isRest ? 'var(--today-paper)' : 'var(--today-muted)',
              border: view.isRest ? 'none' : '1.5px solid var(--today-hairline)',
            }}>
            {view.isRest ? 'Resting today' : 'Make today a rest day'}
          </button>
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles** — `npm run build`.
- [ ] **Step 3: Commit**

```bash
git add src/pages/TodayPage.tsx
git commit -m "Add the Today page"
```

---

### Task 7: Wire Today into the app

The old Home tab stays. Today becomes the landing tab so it gets used, but nothing is removed.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/NavBar.tsx`

- [ ] **Step 1: Widen the page type and add the tab in `src/components/NavBar.tsx`.** Replace the `NavBarProps` interface with:

```ts
type NavPage = 'today' | 'home' | 'workout' | 'library' | 'chat' | 'settings';

interface NavBarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  hasActiveWorkout: boolean;
  workoutType?: WorkoutType;
  workoutProgress?: number;
}
```

Then add a Today button immediately **before** the existing Home button:

```tsx
        <button onClick={() => onNavigate('today')} className={getButtonClass('today')}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={getStrokeWidth('today')} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={getStrokeWidth('today')} d="M12 7.5V12l3 2" />
          </svg>
          <span className={`text-xs ${getFontWeight('today')}`}>Today</span>
        </button>
```

Six tabs now share the row, so reduce the horizontal padding in `getButtonClass` from `px-3` to `px-2`.

- [ ] **Step 2: Add the page in `src/App.tsx`.** Add `import { TodayPage } from './pages/TodayPage';` beside the other page imports. Change the `Page` union to `type Page = 'today' | 'home' | 'workout' | 'library' | 'chat' | 'settings';`. Change the initial state to `useState<Page>('today')`. Add `{currentPage === 'today' && <TodayPage />}` immediately before the existing `{currentPage === 'home' && ...}` line.

- [ ] **Step 3: Typecheck, lint and test** — `npm run build && npm run lint && npm test`.
- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/NavBar.tsx
git commit -m "Add Today as the landing tab, beside the existing Home"
```

---

### Task 8: Verify in a browser

A green typecheck is not evidence the screen works. Drive the built app and assert on what it renders.

**Files:** Create `scripts/smoke-today.mjs`

- [ ] **Step 1: Write `scripts/smoke-today.mjs`**

```js
/**
 * Boots the built app in Chromium and checks the Today screen behaves.
 * Run after `npm run build`, against `npx vite preview --port 4173`.
 */
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173';
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));

const ring = () => page.locator('[role="img"][aria-label$="done today"]').first();
const settle = async () => { await page.waitForTimeout(2600); };

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('workout_onboarding_complete', 'true');
});
await page.reload({ waitUntil: 'networkidle' });
await settle();

check('Today is the landing tab', await ring().isVisible());

// The held dry day means an untouched day starts at 1 of 3.
const start = await ring().getAttribute('aria-label');
check('ring starts at 1 of 3', start === '1 of 3 done today', start ?? '(missing)');

check('the lift is suggested first', await page.getByText('3 left, 6 days').or(page.getByText('Every remaining day')).first().isVisible());

await page.getByRole('button', { name: 'Walk', exact: true }).click();
await page.waitForTimeout(400);
const after = await ring().getAttribute('aria-label');
check('logging Walk advances the ring', after === '2 of 3 done today', after ?? '(missing)');

await page.reload({ waitUntil: 'networkidle' });
await settle();
const persisted = await ring().getAttribute('aria-label');
check('the log survives a reload', persisted === '2 of 3 done today', persisted ?? '(missing)');

// Breaking the held dry day takes the score back down.
await page.getByRole('button', { name: 'Dry day', exact: true }).click();
await page.waitForTimeout(400);
const broken = await ring().getAttribute('aria-label');
check('breaking the dry day lowers the ring', broken === '1 of 3 done today', broken ?? '(missing)');

// The old tabs still work.
for (const tab of ['Home', 'Library', 'Coach', 'Settings']) {
  const before = pageErrors.length;
  await page.getByRole('button', { name: tab, exact: true }).click();
  await page.waitForTimeout(700);
  check(`${tab} tab still opens`, pageErrors.length === before, pageErrors.slice(before).join(' | '));
}

await page.getByRole('button', { name: 'Today', exact: true }).click();
await page.waitForTimeout(500);
check('Today survives a round trip through the old tabs', await ring().isVisible());

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

await page.screenshot({ path: 'today-screen.png' });
await browser.close();

const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: Build and run it**

```bash
npm run build
npx vite preview --port 4173 &
sleep 3
node scripts/smoke-today.mjs
kill %1
```

Expected: every check PASS.

- [ ] **Step 3: Look at the screenshot** at 390x844 against the published mockup: warm paper ground, black rule under the day number, white cards at 18px radius, the serif on the ring fraction and the suggestion name only, green on the ring only.

- [ ] **Step 4: Commit and push**

```bash
git add scripts/smoke-today.mjs
git commit -m "Add a browser smoke test for the Today screen"
git push -u origin feat/today-slice
```
