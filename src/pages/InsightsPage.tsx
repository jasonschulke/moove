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
import { loadBodyMetrics } from '../data/storage';
import { isClaudeAvailable } from '../lib/claudeClient';

type Range = 'week' | 'month' | 'year';

const GREEN = '#047857';
const TRACK = '#ece7dd';
const VIOLET = '#7c3aed';

/** One day as a ring with its date in the middle. */
function DayDonut({ day }: { day: DayCompletion }) {
  const degrees = Math.round(day.completion * 360);
  const ring = day.isFuture || day.isUntracked
    ? '#f4f0e8'
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
          width: 27, height: 27, background: '#ffffff',
          fontSize: 11.5,
          fontWeight: day.isToday ? 700 : 600,
          color: day.isFuture || day.isUntracked ? '#cfc8bb' : day.isToday ? GREEN : 'var(--mv-ink)',
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
        {review.verdict}
      </div>

      {review.bars.map(b => (
        <div key={b.habit.id} className="flex items-center gap-3 py-1.5">
          <span className="w-[88px] flex-shrink-0 text-[13px]" style={{ color: 'var(--mv-ink)' }}>
            {b.habit.name}
          </span>
          <span className="flex-grow h-1.5 rounded-full" style={{ background: TRACK }}>
            <span
              className="block h-1.5 rounded-full"
              style={{
                width: `${Math.round((b.done / b.target) * 100)}%`,
                background: GREEN,
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

function YearPanel({ now }: { now: Date }) {
  const days = useMemo(() => getYearCompletion(now), [now]);

  // Columns are weeks, Monday at the top, so the grid reads like a calendar.
  const columns: DayCompletion[][] = [];
  let column: DayCompletion[] = [];
  const lead = (new Date(now.getFullYear(), 0, 1).getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) column.push(null as unknown as DayCompletion);
  for (const day of days) {
    column.push(day);
    if (column.length === 7) { columns.push(column); column = []; }
  }
  if (column.length) columns.push(column);

  const shade = (d: DayCompletion | null) => {
    if (!d || d.isFuture || d.isUntracked) return '#f4f0e8';
    if (d.completion === 0) return TRACK;
    if (d.isRest) return VIOLET;
    // Three steps, matching the three daily habits.
    if (d.completion >= 1) return GREEN;
    if (d.completion >= 0.66) return '#2f9e78';
    return '#9ecfbc';
  };

  return (
    <>
      <div className="mv-caps mx-1 mb-2">{now.getFullYear()}</div>
      <div className="mv-card p-4">
        <div className="flex gap-[1px] justify-center">
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[1px]">
              {col.map((d, di) => (
                <div
                  key={di}
                                    style={{ width: 5, height: 5, borderRadius: 1, background: shade(d) }}
                  title={d ? `${d.dateStr}: ${Math.round(d.completion * 100)}%` : ''}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function WeightPanel() {
  const metrics = useMemo(
    () => loadBodyMetrics().filter(m => typeof m.weight === 'number').sort((a, b) => a.date.localeCompare(b.date)),
    []
  );

  if (metrics.length === 0) {
    return (
      <>
        <div className="mv-caps mx-1 mb-2">Weight</div>
        <div className="mv-card p-5">
          <div className="text-[13.5px]" style={{ color: 'var(--mv-muted)' }}>
            Nothing recorded. Import from Apple Health in Settings.
          </div>
        </div>
      </>
    );
  }

  const latest = metrics[metrics.length - 1];
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const baseline = metrics.find(m => new Date(m.date) >= monthAgo) ?? metrics[0];
  const delta = latest.weight! - baseline.weight!;

  const values = metrics.slice(-40).map(m => m.weight!);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * 320},${44 - ((v - min) / span) * 38 - 3}`)
    .join(' ');

  return (
    <>
      <div className="mv-caps mx-1 mb-2">Weight</div>
      <div className="mv-card p-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="mv-serif text-[26px]" style={{ color: 'var(--mv-ink)' }}>
            {latest.weight!.toFixed(1)}
            <span className="text-[14px]" style={{ color: 'var(--mv-faint)' }}> lb</span>
          </span>
          <span className="mv-caps" style={{ color: delta <= 0 ? GREEN : 'var(--mv-ink)' }}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)} this month
          </span>
        </div>
        <svg width="100%" height="44" viewBox="0 0 320 44" preserveAspectRatio="none" className="block">
          <polyline points={points} fill="none" stroke={GREEN} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </>
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
        <ScreenHeader
          label="Insights"
          alt="Insights"
          trailing={
            <div className="flex gap-4 flex-shrink-0">
              {(['week', 'month', 'year'] as Range[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className="mv-caps pb-0.5"
                  style={
                    range === r
                      ? { color: 'var(--mv-ink)', borderBottom: '2px solid var(--mv-ink)' }
                      : undefined
                  }
                >
                  {r}
                </button>
              ))}
            </div>
          }
        />

        <section className="px-4 pt-6 mv-rise">
          {range === 'week' && <WeekPanel now={now} />}
          {range === 'month' && <MonthPanel now={now} />}
          {range === 'year' && <YearPanel now={now} />}
        </section>

        <section className="px-4 pt-6 mv-rise">
          <WeightPanel />
        </section>
      </div>

      {/* The coach as a layer over the data, not a separate room. */}
      <div
        className="fixed left-0 right-0 bottom-16 px-4 pt-3 pb-3 safe-bottom"
        style={{ background: 'rgba(250, 247, 242, 0.97)', borderTop: '1px solid var(--mv-hairline)' }}
      >
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => coachReady && setChatOpen(true)}
            disabled={!coachReady}
            className="w-full flex items-center gap-2 h-12 pl-4 pr-1.5 rounded-[13px] bg-white disabled:opacity-60"
            style={{ border: '1px solid var(--mv-hairline)' }}
          >
            <span className="flex-grow text-left text-[14px]" style={{ color: 'var(--mv-faint)' }}>
              {coachReady ? 'Ask about your week' : 'Add a Claude key in Settings'}
            </span>
            <span
              className="flex items-center justify-center w-9 h-9 rounded-[10px] flex-shrink-0"
              style={{ background: 'var(--mv-ink)' }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#faf7f2"
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
