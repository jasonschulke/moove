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

  // pb-24 clears the 64px nav bar plus the safe area. The nav is flat now, so
  // nothing overhangs it.
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
