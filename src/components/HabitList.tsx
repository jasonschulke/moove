/**
 * The tickable list of habits for one day.
 *
 * Today renders it for today. The month grid in Insights renders it for a day
 * you tapped, so a day you forgot can be filled in after the fact. Both need
 * exactly the same behaviour, which is why this is not part of either screen.
 */

import { useState } from 'react';
import type { HabitStatus } from '../data/today';
import { toggleHabit, setHabitDone, recordHabitValue, habitColor } from '../data/habits';
import { HabitIcon } from './HabitIcon';

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
  // Pre-filled with the day's reading if there is one, because the common case
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

  // A measured habit reports its reading, and its goal alongside when it has
  // one. Weekly habits carry their debt. Plain daily ones say nothing extra;
  // the ring already speaks for them.
  const reading = !habit.unit ? null
    : value !== null && habit.target !== undefined ? `${value} / ${habit.target} ${habit.unit}`
    : value !== null ? `${value} ${habit.unit}`
    : habit.target !== undefined ? `Goal ${habit.target} ${habit.unit}`
    : null;
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

export function HabitList({ statuses, dateStr, onChange }: {
  statuses: HabitStatus[];
  dateStr: string;
  /** Called after any write, so the owning screen can recompute its numbers. */
  onChange: () => void;
}) {
  // The habit whose number pad is open, if any.
  const [entering, setEntering] = useState<string | null>(null);

  // A habit with a unit cannot be ticked, only measured, so tapping one opens
  // the pad instead of toggling. Tapping again closes it.
  const press = (status: HabitStatus) => {
    if (status.habit.unit) {
      setEntering(current => (current === status.habit.id ? null : status.habit.id));
      return;
    }
    toggleHabit(status.habit, dateStr);
    onChange();
  };

  const save = (status: HabitStatus, value: number) => {
    // A fat-fingered decimal is easy and a bad point is permanent in a chart.
    if (!recordHabitValue(status.habit.id, dateStr, value)) return;
    setEntering(null);
    onChange();
  };

  const clear = (status: HabitStatus) => {
    setHabitDone(status.habit.id, dateStr, false);
    setEntering(null);
    onChange();
  };

  return (
    <div className="flex flex-col gap-2">
      {statuses.map(status => (
        <HabitRow
          key={status.habit.id}
          status={status}
          open={entering === status.habit.id}
          onPress={() => press(status)}
          onSave={value => save(status, value)}
          onCancel={() => setEntering(null)}
          onClear={() => clear(status)}
        />
      ))}
    </div>
  );
}

