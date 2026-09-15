/**
 * Today.
 *
 * One question: what is still open today. The ring says how much of the day is
 * closed and the list lets you close it. Nothing here is editable; habits are
 * configured in Library.
 */

import { useCallback, useEffect, useState } from 'react';
import { getTodayView } from '../data/today';
import { toggleRestDay } from '../data/storage';
import { say } from '../data/voice';
import { CompletionRing } from '../components/CompletionRing';
import { HabitList } from '../components/HabitList';
import { ScreenHeader } from '../components/ScreenHeader';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface TodayPageProps {
  /** Set while a workout session is running, so Today can offer a way back. */
  activeWorkout?: { name: string; onResume: () => void };
}

export function TodayPage({ activeWorkout }: TodayPageProps = {}) {
  const [view, setView] = useState(() => getTodayView());
  const refresh = useCallback(() => setView(getTodayView()), []);

  // Recompute when the tab comes back into view, so a phone left open
  // overnight does not keep showing yesterday.
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const handleToggleRest = () => {
    toggleRestDay(view.dateStr);
    refresh();
  };

  const now = new Date();
  const monthName = MONTHS[now.getMonth()];

  // pb-24 clears the 64px nav bar plus the safe area. The nav is flat now, so
  // nothing overhangs it.
  return (
    <div className="mv-paper min-h-screen pb-24">
      <div className="max-w-lg mx-auto">

        <ScreenHeader wordmark="/moove.svg" alt="Moove" />

        {activeWorkout && (
          <section className="px-4 pt-5 mv-rise">
            <button
              onClick={activeWorkout.onResume}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-[18px] text-left"
              style={{ background: 'var(--mv-ink)', color: 'var(--mv-paper)' }}
            >
              <span className="min-w-0">
                <span className="mv-caps block mb-0.5" style={{ color: 'rgba(250,247,242,0.65)' }}>In progress</span>
                <span className="block text-[15px] truncate">{activeWorkout.name}</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M5 12h13" /><path d="M12 5l7 7-7 7" />
              </svg>
            </button>
          </section>
        )}

        <section className="px-4 pt-6 mv-rise">
          <div className="mv-card flex items-center gap-5 p-5">
            <CompletionRing completed={view.completed} total={view.total} size={104} />
            <div className="min-w-0">
              <div className="mv-caps mb-1.5">
                {WEEKDAYS[now.getDay()]} {view.dayOfMonth} {monthName}
              </div>
              <div className="text-[14px] leading-snug" style={{ color: 'var(--mv-muted)' }}>
                {say(view.daySituation, {
                  open: view.total - view.completed,
                  total: view.total,
                }, undefined, view.dateStr)}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pt-5 mv-rise">
          <HabitList statuses={view.statuses} dateStr={view.dateStr} onChange={refresh} />
        </section>

        <div className="px-4 pt-5">
          <button onClick={handleToggleRest}
            className="w-full h-11 rounded-[13px] text-[13px] font-medium transition-colors"
            style={{
              background: view.isRest ? 'var(--mv-ink)' : 'transparent',
              color: view.isRest ? 'var(--mv-paper)' : 'var(--mv-muted)',
              border: view.isRest ? 'none' : '1.5px solid var(--mv-hairline)',
            }}>
            {view.isRest ? 'Resting today' : 'Make today a rest day'}
          </button>
        </div>

      </div>
    </div>
  );
}
