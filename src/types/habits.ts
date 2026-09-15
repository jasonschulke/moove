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
  /** A daily state with a weekly quota, e.g. dry on 5 of 7 days. In the day score. */
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
