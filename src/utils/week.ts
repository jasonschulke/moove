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
