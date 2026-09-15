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
  /**
   * A Material Symbols ligature name, e.g. "directions_walk". The font is
   * already loaded for the rest of the app, so this costs no bundle.
   * Optional: habits made before icons existed simply show none.
   */
  icon?: string;
  /**
   * A key from HABIT_COLORS. Tints this habit wherever it appears: its icon,
   * its check when done, its bar in Insights. Optional; without one a habit
   * uses the app's green.
   */
  color?: string;
  /**
   * Set for habits that record a number rather than a tick, e.g. "lb" on
   * weight. Tapping one on Today opens an entry field; confirming a value both
   * stores it and checks the habit off.
   */
  unit?: string;
  /**
   * Where a measured habit's number is kept. Absent means the habit log.
   * 'bodyWeight' points at body_metrics, which already holds the weight
   * history, feeds the chart, syncs to Supabase and receives Health
   * imports. Two stores for one number would disagree inside a day.
   */
  source?: 'bodyWeight';
  order: number;
}

/**
 * date (YYYY-MM-DD) -> habit id -> what happened.
 *
 * `true` or `false` for an ordinary habit. A number for one that carries a
 * unit, which counts as done by virtue of having a value at all. Absent means
 * "use the habit's default".
 */
export type HabitLogMap = Record<string, Record<string, boolean | number>>;
