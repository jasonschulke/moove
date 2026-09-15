/**
 * Insights.
 *
 * The broader cadence. Today asks what to do now; this asks how it has been
 * going, which is a weekly or monthly question, not a daily one. The coach
 * sits at the bottom as a composer so it reads as a layer over what you are
 * looking at rather than a separate room.
 */

import { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { ClaudeChat } from '../components/ClaudeChat';
import { getWeekReview, getMonthCompletion, getYearCompletion, monthLabel } from '../data/insights';
import type { DayCompletion } from '../data/insights';
import { say } from '../data/voice';
import { HabitIcon } from '../components/HabitIcon';
import { habitColor, measuredHabits, habitSeries, loadHabitLogs } from '../data/habits';
import type { Habit } from '../types/habits';
import { isClaudeAvailable } from '../lib/claudeClient';

type Range = 'week' | 'month' | 'year';

// Read from the stylesheet so the screen follows the theme. Hardcoding these
// is what left Today and Insights stranded in light while the rest went dark.
const GREEN = 'var(--mv-green)';
const TRACK = 'var(--mv-track)';
const VIOLET = 'var(--mv-violet)';

/** One day as a ring with its date in the middle. */
function DayDonut({ day }: { day: DayCompletion }) {
  const degrees = Math.round(day.completion * 360);
  const ring = day.isFuture || day.isUntracked
    ? 'var(--mv-empty)'
    : day.isRest
      ? `conic-gradient(from -90deg, ${VIOLET} 0deg ${degrees}deg, ${TRACK} ${degrees}deg 360deg)`
      : `conic-gradient(from -90deg, ${GREEN} 0deg ${degrees}deg, ${TRACK} ${degrees}deg 360deg)`;

  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{ width: 38, height: 38, background: ring }}
      title={`${day.dateStr}: ${Math.round(day.completion * 100)}%`}
    >
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: 27, height: 27, background: 'var(--mv-card)',
          fontSize: 11.5,
          fontWeight: day.isToday ? 700 : 600,
          color: day.isFuture || day.isUntracked ? 'var(--mv-empty-ink)' : day.isToday ? GREEN : 'var(--mv-ink)',
        }}
      >
        {day.dayOfMonth}
      </span>
    </div>
  );
}

function WeekPanel({ now }: { now: Date }) {
  const review = useMemo(() => getWeekReview(now), [now]);

  return (
    <div className="mv-card p-5">
      <div className="mv-caps mb-2">{review.rangeLabel}</div>
      <div className="mv-serif text-[23px] leading-snug mb-4" style={{ color: 'var(--mv-ink)' }}>
        {say(review.situation, {
          closed: review.daysClosed,
          counted: review.daysCounted,
          habit: review.worstHabit ?? undefined,
        })}
      </div>

      {review.bars.map(b => (
        <div key={b.habit.id} className="flex items-center gap-2 py-1.5">
          <HabitIcon icon={b.habit.icon} size={17} style={{ color: habitColor(b.habit) }} />
          <span className="w-[80px] flex-shrink-0 text-[13px] truncate" style={{ color: 'var(--mv-ink)' }}>
            {b.habit.name}
          </span>
          <span className="flex-grow h-1.5 rounded-full" style={{ background: TRACK }}>
            <span
              className="block h-1.5 rounded-full"
              style={{
                width: `${Math.round((b.done / b.target) * 100)}%`,
                background: habitColor(b.habit),
                transition: 'width 0.5s cubic-bezier(0.16, 0.8, 0.3, 1)',
              }}
            />
          </span>
          <span
            className="mv-caps w-8 text-right flex-shrink-0"
            style={{ color: b.done < b.target ? 'var(--mv-ink)' : 'var(--mv-muted)' }}
          >
            {b.done}/{b.target}
          </span>
        </div>
      ))}
    </div>
  );
}

function MonthPanel({ now }: { now: Date }) {
  const days = useMemo(() => getMonthCompletion(now), [now]);
  // Blank cells so the 1st lands under its weekday, Monday first.
  const lead = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;

  return (
    <>
      <div className="mv-caps mx-1 mb-2">{monthLabel(now)}</div>
      <div className="mv-card p-4">
        <div className="grid grid-cols-7 justify-items-center mb-2">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="mv-caps">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 justify-items-center gap-y-2">
          {Array.from({ length: lead }).map((_, i) => <div key={`lead-${i}`} style={{ width: 38, height: 38 }} />)}
          {days.map(d => <DayDonut key={d.dateStr} day={d} />)}
        </div>
      </div>
    </>
  );
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Cell and gap in px. Columns are weeks, so the pitch is cell + gap. */
const YEAR_CELL = 13;
const YEAR_GAP = 3;
const YEAR_PITCH = YEAR_CELL + YEAR_GAP;

function YearPanel({ now }: { now: Date }) {
  const days = useMemo(() => getYearCompletion(now), [now]);

  // Columns are weeks, Monday at the top, so the grid reads like a calendar.
  const columns: (DayCompletion | null)[][] = [];
  let column: (DayCompletion | null)[] = [];
  const lead = (new Date(now.getFullYear(), 0, 1).getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) column.push(null);
  for (const day of days) {
    column.push(day);
    if (column.length === 7) { columns.push(column); column = []; }
  }
  if (column.length) {
    while (column.length < 7) column.push(null);
    columns.push(column);
  }

  // A month's label sits over the first column that contains its first week.
  const monthStarts = new Map<number, number>();
  columns.forEach((col, i) => {
    for (const day of col) {
      if (!day) continue;
      const month = new Date(day.dateStr + 'T00:00:00').getMonth();
      if (!monthStarts.has(month)) monthStarts.set(month, i);
      break;
    }
  });

  const shade = (d: DayCompletion | null) => {
    if (!d || d.isFuture || d.isUntracked) return 'var(--mv-empty)';
    if (d.completion === 0) return 'var(--mv-track)';
    if (d.isRest) return 'var(--mv-violet)';
    // Three steps, matching the three daily habits.
    if (d.completion >= 1) return GREEN;
    if (d.completion >= 0.66) return 'var(--mv-green-2)';
    return 'var(--mv-green-1)';
  };

  const swatch = (background: string, key: string) => (
    <span key={key} className="inline-block rounded-[3px]"
      style={{ width: 11, height: 11, background }} />
  );

  return (
    <>
      <div className="mv-caps mx-1 mb-2">{now.getFullYear()}</div>
      <div className="mv-card p-4">
        {/* Fifty-three columns of readable squares are wider than a phone, so
            the grid scrolls sideways. Squashing them to fit is what made this
            a barcode. */}
        <div className="overflow-x-auto -mx-1 px-1">
          <div style={{ width: columns.length * YEAR_PITCH }}>
            <div className="relative h-4 mb-1">
              {[...monthStarts.entries()].map(([month, col]) => (
                <span
                  key={month}
                  className="absolute top-0 text-[10px] whitespace-nowrap"
                  style={{ left: col * YEAR_PITCH, color: 'var(--mv-faint)' }}
                >
                  {MONTH_ABBR[month]}
                </span>
              ))}
            </div>
            <div className="flex" style={{ gap: YEAR_GAP }}>
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col" style={{ gap: YEAR_GAP }}>
                  {col.map((d, di) => (
                    <div
                      key={di}
                      className="rounded-[3px]"
                      style={{ width: YEAR_CELL, height: YEAR_CELL, background: shade(d) }}
                      title={d ? `${d.dateStr}: ${Math.round(d.completion * 100)}%` : ''}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Small and lower case: a key should sit under the picture, not
            compete with it. */}
        <div className="flex items-center gap-3 mt-3 flex-wrap text-[10px]"
          style={{ color: 'var(--mv-faint)' }}>
          <span className="flex items-center gap-1">
            Less
            {swatch('var(--mv-track)', 'l0')}
            {swatch('var(--mv-green-1)', 'l1')}
            {swatch('var(--mv-green-2)', 'l2')}
            {swatch(GREEN, 'l3')}
            More
          </span>
          <span className="flex items-center gap-1">
            {swatch('var(--mv-violet)', 'rest')}
            Rest
          </span>
          <span className="flex items-center gap-1">
            {swatch('var(--mv-empty)', 'empty')}
            Untracked
          </span>
        </div>
      </div>
    </>
  );
}

/**
 * The weight line. Read-only: logging happens on Today, where weight is a
 * habit like any other, so there is one place to record a thing and one place
 * to look at it.
 */
/**
 * One measured habit's readings as a line.
 *
 * Any habit that carries a unit gets one of these, not just weight. The line
 * takes the habit's own colour so the chart and the row on Today read as the
 * same thing, and the target, if there is one, is drawn across it.
 */
function MeasuredChart({ habit }: { habit: Habit }) {
  const series = useMemo(() => habitSeries(habit, loadHabitLogs()), [habit]);
  const color = habitColor(habit);

  if (series.length === 0) {
    return (
      <div className="mv-card p-5">
        <div className="text-[13.5px]" style={{ color: 'var(--mv-muted)' }}>
          Nothing recorded yet. Tap {habit.name} on Today to log one.
        </div>
      </div>
    );
  }

  const latest = series[series.length - 1];
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const baseline = series.find(p => new Date(p.date) >= monthAgo) ?? series[0];
  const delta = latest.value - baseline.value;

  // Only the last 40 readings. Beyond that the line is noise at this width.
  const values = series.slice(-40).map(p => p.value);

  // The target has to be inside the scale or the dashed line falls off the card.
  const bounds = habit.target === undefined ? values : [...values, habit.target];
  const min = Math.min(...bounds);
  const max = Math.max(...bounds);
  const span = max - min || 1;
  const y = (v: number) => 44 - ((v - min) / span) * 38 - 3;
  const points = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * 320},${y(v)}`)
    .join(' ');

  // Falling is good for something you are cutting down, rising for something
  // you are building up. With no target there is no good direction to claim.
  const improving = habit.target === undefined
    ? null
    : habit.targetDirection === 'atMost' ? delta <= 0 : delta >= 0;

  return (
    <div className="mv-card p-4">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="mv-serif text-[26px]" style={{ color: 'var(--mv-ink)' }}>
          {latest.value.toFixed(1)}
          <span className="text-[14px]" style={{ color: 'var(--mv-faint)' }}> {habit.unit}</span>
        </span>
        <span className="mv-caps text-right"
          style={{ color: improving === false ? 'var(--mv-ink)' : improving === true ? GREEN : 'var(--mv-muted)' }}>
          {delta > 0 ? '+' : ''}{delta.toFixed(1)} this month
        </span>
      </div>
      {values.length > 1 && (
        <svg width="100%" height="44" viewBox="0 0 320 44" preserveAspectRatio="none" className="block">
          {habit.target !== undefined && (
            <line x1="0" y1={y(habit.target)} x2="320" y2={y(habit.target)}
              stroke="var(--mv-track)" strokeWidth="1.5" strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke" />
          )}
          <polyline points={points} fill="none" stroke={color} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {habit.target !== undefined && (
        <div className="mv-caps mt-2" style={{ color: 'var(--mv-faint)' }}>
          Target {habit.targetDirection === 'atMost' ? 'at most' : 'at least'} {habit.target} {habit.unit}
        </div>
      )}
    </div>
  );
}

/** Every measured habit, each with its own card. */
function MeasuredPanels() {
  const habits = useMemo(() => measuredHabits(), []);
  if (habits.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {habits.map(habit => (
        <div key={habit.id}>
          <div className="mv-caps mx-1 mb-2 flex items-center gap-1.5">
            <HabitIcon icon={habit.icon} size={14} style={{ color: habitColor(habit) }} />
            {habit.name}
          </div>
          <MeasuredChart habit={habit} />
        </div>
      ))}
    </div>
  );
}

export function InsightsPage() {
  const [range, setRange] = useState<Range>('week');
  const [chatOpen, setChatOpen] = useState(false);
  const now = useMemo(() => new Date(), []);
  const coachReady = isClaudeAvailable();

  if (chatOpen) {
    return (
      <div className="min-h-screen mv-paper">
        <button
          onClick={() => setChatOpen(false)}
          className="absolute top-14 right-4 z-50 mv-caps px-3 py-2"
          style={{ color: 'var(--mv-ink)' }}
        >
          Close
        </button>
        <ClaudeChat />
      </div>
    );
  }

  return (
    <div className="mv-paper min-h-screen pb-40">
      <div className="max-w-lg mx-auto">
        <ScreenHeader label="Insights" alt="Insights" />

        {/* The same segmented control Library uses for its tabs. */}
        <div className="px-4 mt-4">
          <div className="flex rounded-xl bg-slate-200 dark:bg-slate-800 p-1">
            {(['week', 'month', 'year'] as Range[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`flex-1 py-2.5 px-1 rounded-lg text-[12.5px] font-medium capitalize transition-colors ${
                  range === r
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <section className="px-4 pt-5 mv-rise">
          {range === 'week' && <WeekPanel now={now} />}
          {range === 'month' && <MonthPanel now={now} />}
          {range === 'year' && <YearPanel now={now} />}
        </section>

        <section className="px-4 pt-6 mv-rise">
          <MeasuredPanels />
        </section>
      </div>

      {/* The coach as a layer over the data, not a separate room. */}
      <div
        className="fixed left-0 right-0 bottom-16 px-4 pt-3 pb-3 safe-bottom"
        style={{ background: 'var(--mv-scrim)', borderTop: '1px solid var(--mv-hairline)' }}
      >
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => coachReady && setChatOpen(true)}
            disabled={!coachReady}
            className="w-full flex items-center gap-2 h-12 pl-4 pr-1.5 rounded-[13px] disabled:opacity-60"
            style={{ background: 'var(--mv-card)', border: '1px solid var(--mv-hairline)' }}
          >
            <span className="flex-grow text-left text-[14px]" style={{ color: 'var(--mv-faint)' }}>
              {coachReady ? 'Ask about your week' : 'Add a Claude key in Settings'}
            </span>
            <span
              className="flex items-center justify-center w-9 h-9 rounded-[10px] flex-shrink-0"
              style={{ background: 'var(--mv-ink)' }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--mv-paper)"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13" /><path d="M12 5l7 7-7 7" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
