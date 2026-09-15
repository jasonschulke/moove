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
import { toggleHabit, setHabitDone, recordHabitValue, habitColor } from '../data/habits';
import { toggleRestDay } from '../data/storage';
import { say } from '../data/voice';
import { CompletionRing } from '../components/CompletionRing';
import { HabitIcon } from '../components/HabitIcon';
import { ScreenHeader } from '../components/ScreenHeader';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CheckMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/**
 * The number pad for a habit that records a reading rather than a tick.
 * Opens under its own row so the thing being measured stays on screen.
 */
function MeasuredEntry({ status, onSave, onCancel, onClear }: {
  status: HabitStatus;
  onSave: (value: number) => void;
  onCancel: () => void;
  onClear: () => void;
}) {
  const { habit, value, done } = status;
  // Pre-filled with today's reading if there is one, because the common case
  // is a correction, and blank otherwise rather than with yesterday's number,
  // which would be a figure you could confirm without having stood on a scale.
  const [draft, setDraft] = useState(value === null ? '' : String(value));

  const save = () => {
    const parsed = parseFloat(draft);
    if (Number.isFinite(parsed)) onSave(parsed);
  };

  return (
    <div className="px-4 pb-4 flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); }}
        placeholder={habit.unit}
        aria-label={`${habit.name} in ${habit.unit}`}
        autoFocus
        className="mv-number flex-grow min-w-0 px-3 h-10 rounded-[10px] text-[15px] bg-transparent outline-none"
        style={{ border: '1.5px solid var(--mv-track)', color: 'var(--mv-ink)' }}
      />
      {done && (
        <button onClick={onClear} aria-label={`Clear ${habit.name}`} className="mv-caps px-2 h-10">
          Clear
        </button>
      )}
      <button onClick={onCancel} aria-label={`Cancel ${habit.name}`} className="mv-caps px-2 h-10">
        Cancel
      </button>
      <button
        onClick={save}
        disabled={!draft.trim()}
        aria-label={`Save ${habit.name}`}
        className="px-4 h-10 rounded-[10px] text-[13px] font-semibold disabled:opacity-40 flex-shrink-0"
        style={{ background: 'var(--mv-ink)', color: 'var(--mv-paper)' }}
      >Save</button>
    </div>
  );
}

function HabitRow({ status, open, onPress, onSave, onCancel, onClear }: {
  status: HabitStatus;
  open: boolean;
  onPress: () => void;
  onSave: (value: number) => void;
  onCancel: () => void;
  onClear: () => void;
}) {
  const { habit, done, owed, perWeek, doneThisWeek, value } = status;

  // A measured habit reports its reading. Weekly habits carry their debt.
  // Plain daily ones say nothing extra; the ring already speaks for them.
  const reading = habit.unit && value !== null ? `${value} ${habit.unit}` : null;
  const detail = perWeek > 0 ? `${doneThisWeek} of ${perWeek} this week` : null;

  return (
    <div className="mv-card">
      <button
        onClick={onPress}
        aria-pressed={done}
        aria-expanded={habit.unit ? open : undefined}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:scale-[0.99] transition-transform"
      >
        <span className="flex items-center justify-center flex-shrink-0 rounded-full transition-colors"
          style={{
            width: 26, height: 26,
            background: done ? habitColor(habit) : 'transparent',
            border: done ? 'none' : '1.8px solid var(--mv-track)',
          }}>
          {done && <CheckMark />}
        </span>

        <HabitIcon
          icon={habit.icon}
          size={20}
          style={{ color: habitColor(habit), opacity: done ? 0.45 : 1 }}
        />

        <span className="flex-grow min-w-0 text-[15px]"
          style={{ color: 'var(--mv-ink)', opacity: done ? 0.45 : 1 }}>
          {habit.name}
        </span>

        {reading ? (
          <span className="flex-shrink-0 text-[13.5px] tabular-nums"
            style={{ color: 'var(--mv-muted)' }}>
            {reading}
          </span>
        ) : detail ? (
          <span className="mv-caps flex-shrink-0"
            style={{ color: owed > 0 ? 'var(--mv-ink)' : 'var(--mv-muted)' }}>
            {detail}
          </span>
        ) : null}
      </button>

      {open && (
        <MeasuredEntry status={status} onSave={onSave} onCancel={onCancel} onClear={onClear} />
      )}
    </div>
  );
}

interface TodayPageProps {
  /** Set while a workout session is running, so Today can offer a way back. */
  activeWorkout?: { name: string; onResume: () => void };
}

export function TodayPage({ activeWorkout }: TodayPageProps = {}) {
  const [view, setView] = useState(() => getTodayView());
  // The habit whose number pad is open, if any.
  const [entering, setEntering] = useState<string | null>(null);
  const refresh = useCallback(() => setView(getTodayView()), []);

  // Recompute when the tab comes back into view, so a phone left open
  // overnight does not keep showing yesterday.
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  // A habit with a unit cannot be ticked, only measured, so tapping one opens
  // the pad instead of toggling. Tapping again closes it.
  const handlePress = (status: HabitStatus) => {
    if (status.habit.unit) {
      setEntering(current => (current === status.habit.id ? null : status.habit.id));
      return;
    }
    toggleHabit(status.habit, view.dateStr);
    refresh();
  };

  const handleSave = (status: HabitStatus, value: number) => {
    // A fat-fingered decimal is easy and a bad point is permanent in a chart.
    if (!recordHabitValue(status.habit.id, view.dateStr, value)) return;
    setEntering(null);
    refresh();
  };

  const handleClear = (status: HabitStatus) => {
    setHabitDone(status.habit.id, view.dateStr, false);
    setEntering(null);
    refresh();
  };

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

        <ScreenHeader
          wordmark="/moove.svg"
          alt="Moove"
          trailing={
            <span className="mv-caps flex-shrink-0">
              {WEEKDAYS[now.getDay()]} {view.dayOfMonth} {monthName}
            </span>
          }
        />

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
              <div className="mv-caps mb-1.5">Today</div>
              <div className="text-[14px] leading-snug" style={{ color: 'var(--mv-muted)' }}>
                {say(view.daySituation, {
                  open: view.total - view.completed,
                  total: view.total,
                }, undefined, view.dateStr)}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pt-4 mv-rise">
          <div className="mv-card p-5">
            <div className="mv-caps mb-2">{view.isRest ? 'Rest day' : 'Next'}</div>
            {view.isRest ? (
              <div className="mv-serif text-[24px] leading-snug" style={{ color: 'var(--mv-ink)' }}>
                {say('dayRest', {}, undefined, view.dateStr)}
              </div>
            ) : view.suggestion ? (
              <>
                <div className="mv-serif text-[26px] leading-tight mb-1" style={{ color: 'var(--mv-ink)' }}>
                  {view.suggestion.habit.name}
                </div>
                <div className="text-[13.5px]" style={{ color: 'var(--mv-muted)' }}>
                  {say(view.suggestion.situation, {
                    owed: view.suggestion.owed,
                    daysLeft: view.suggestion.daysLeft,
                    habit: view.suggestion.habit.name,
                  }, undefined, view.dateStr)}
                </div>
              </>
            ) : (
              <div className="mv-serif text-[26px] leading-tight" style={{ color: 'var(--mv-ink)' }}>
                {say('allSettled', {}, undefined, view.dateStr)}
              </div>
            )}
          </div>
        </section>

        <section className="px-4 pt-5 flex flex-col gap-2 mv-rise">
          {view.statuses.map(status => (
            <HabitRow
              key={status.habit.id}
              status={status}
              open={entering === status.habit.id}
              onPress={() => handlePress(status)}
              onSave={value => handleSave(status, value)}
              onCancel={() => setEntering(null)}
              onClear={() => handleClear(status)}
            />
          ))}
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
