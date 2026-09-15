/**
 * The week as seven bars.
 *
 * Today answers "what now" and the ring answers "how much of today". Neither
 * says whether this has been a good week, which is the question the week card
 * in Insights answers and the reason to open it. Seven bars is that answer at
 * a glance, in the space Today already had going spare.
 *
 * Bars rather than the month's donuts on purpose: at this size a dip in a row
 * of bars is visible without reading any of them, which is the whole job.
 */

import { getWeekDays } from '../data/insights';
import { completionColor } from '../utils/completionColor';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const HEIGHT = 42;

export function WeekStrip({ now }: { now: Date }) {
  // Recomputed every render on purpose. Today hands a fresh Date down, so a
  // memo would never hit, and ticking a habit has to move today's bar.
  const days = getWeekDays(now);

  return (
    <div className="mv-card p-4">
      <div className="mv-caps mb-3">This week</div>
      <div className="flex items-end justify-between">
        {days.map((day, i) => {
          const filled = !day.isFuture && !day.isUntracked && day.completion > 0;
          return (
            <div key={day.dateStr} className="flex flex-col items-center gap-2">
              <div
                className="rounded-full flex items-end overflow-hidden"
                style={{ width: 10, height: HEIGHT, background: 'var(--mv-track)' }}
                role="img"
                aria-label={`${day.dateStr}, ${Math.round(day.completion * 100)} percent`}
              >
                <div
                  className="w-full rounded-full"
                  style={{
                    height: `${Math.round(day.completion * 100)}%`,
                    background: filled ? completionColor(day.completion) : 'transparent',
                    transition: 'height 0.5s cubic-bezier(0.16, 0.8, 0.3, 1), background 0.4s ease',
                  }}
                />
              </div>
              <span className="mv-caps"
                style={{ color: day.isToday ? 'var(--mv-ink)' : 'var(--mv-faint)' }}>
                {LETTERS[i]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
