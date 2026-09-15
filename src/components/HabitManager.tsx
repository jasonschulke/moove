/**
 * Habit management, the Library's job.
 *
 * Add, edit, delete, reorder, set cadence. Nothing here is reachable from
 * Today, which only logs.
 *
 * Reorder is up/down buttons rather than drag. Drag on a phone list is fiddly
 * to hit and needs a library; two buttons are reliable and testable.
 */

import { useState } from 'react';
import type { Habit, HabitCadence } from '../types/habits';
import { loadHabits, addHabit, updateHabit, deleteHabit, moveHabit, describeCadence, habitColor } from '../data/habits';
import { IconPicker } from './IconPicker';
import { HabitIcon } from './HabitIcon';

type CadenceKind = HabitCadence['kind'];

const CADENCE_LABELS: Record<CadenceKind, string> = {
  'daily': 'Every day',
  'daily-quota': 'Most days',
  'weekly': 'Some days a week',
};

const CADENCE_HELP: Record<CadenceKind, string> = {
  'daily': 'Counts toward the day ring. Owed every day.',
  'daily-quota': 'Counts toward the day ring, with a weekly allowance.',
  'weekly': 'Owed a number of times a week, on no particular day. Not in the day ring.',
};

interface DraftState {
  id: string | null;
  name: string;
  kind: CadenceKind;
  perWeek: number;
  heldByDefault: boolean;
  icon: string | undefined;
  color: string | undefined;
}

const blankDraft = (): DraftState =>
  ({ id: null, name: '', kind: 'daily', perWeek: 3, heldByDefault: false, icon: undefined, color: undefined });

const draftFrom = (habit: Habit): DraftState => ({
  id: habit.id,
  name: habit.name,
  kind: habit.cadence.kind,
  perWeek: habit.cadence.kind === 'daily' ? 3 : habit.cadence.perWeek,
  heldByDefault: habit.heldByDefault,
  icon: habit.icon,
  color: habit.color,
});

function HabitEditor({ draft, onChange, onSave, onCancel }: {
  draft: DraftState;
  onChange: (d: DraftState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const needsCount = draft.kind !== 'daily';

  return (
    <div className="mv-card p-4 mb-3">
      <div className="mv-caps mb-3">{draft.id ? 'Edit habit' : 'New habit'}</div>

      <div className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-[10px]"
        style={{ border: '1.5px solid var(--mv-track)' }}>
        <HabitIcon icon={draft.icon} size={20} style={{ color: habitColor(draft) }} />
        <input
          type="text"
          value={draft.name}
          onChange={e => onChange({ ...draft, name: e.target.value })}
          placeholder="What are you tracking?"
          aria-label="Habit name"
          className="flex-grow min-w-0 text-[15px] bg-transparent outline-none"
          style={{ color: 'var(--mv-ink)' }}
        />
      </div>

      <div className="mv-caps mb-2">How often</div>
      <div className="flex flex-col gap-1.5 mb-3">
        {(Object.keys(CADENCE_LABELS) as CadenceKind[]).map(kind => (
          <button
            key={kind}
            onClick={() => onChange({ ...draft, kind })}
            className="text-left px-3 py-2.5 rounded-[10px]"
            style={{
              border: `1.5px solid ${draft.kind === kind ? 'var(--mv-green)' : 'var(--mv-track)'}`,
              color: 'var(--mv-ink)',
            }}
          >
            <span className="block text-[14px]">{CADENCE_LABELS[kind]}</span>
            <span className="block text-[12px] mt-0.5" style={{ color: 'var(--mv-muted)' }}>
              {CADENCE_HELP[kind]}
            </span>
          </button>
        ))}
      </div>

      {needsCount && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-[14px]" style={{ color: 'var(--mv-ink)' }}>
            {draft.kind === 'daily-quota' ? 'Days a week' : 'Times a week'}
          </span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map(n => (
              <button
                key={n}
                onClick={() => onChange({ ...draft, perWeek: n })}
                aria-label={`${n} a week`}
                aria-pressed={draft.perWeek === n}
                className="w-8 h-8 rounded-full text-[13px]"
                style={
                  draft.perWeek === n
                    ? { background: 'var(--mv-green)', color: '#ffffff' }
                    : { border: '1.5px solid var(--mv-track)', color: 'var(--mv-ink)' }
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => onChange({ ...draft, heldByDefault: !draft.heldByDefault })}
        aria-pressed={draft.heldByDefault}
        className="w-full text-left px-3 py-2.5 mb-4 rounded-[10px]"
        style={{
          border: `1.5px solid ${draft.heldByDefault ? 'var(--mv-green)' : 'var(--mv-track)'}`,
          color: 'var(--mv-ink)',
        }}
      >
        <span className="block text-[14px]">Held unless I break it</span>
        <span className="block text-[12px] mt-0.5" style={{ color: 'var(--mv-muted)' }}>
          For habits that are true until they are not, like a dry day. Starts each day done.
        </span>
      </button>

      <div className="mb-4">
        <IconPicker
          value={draft.icon}
          onChange={icon => onChange({ ...draft, icon })}
          color={draft.color}
          onColorChange={color => onChange({ ...draft, color })}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 h-11 rounded-[12px] text-[14px] font-medium"
          style={{ border: '1.5px solid var(--mv-hairline)', color: 'var(--mv-muted)' }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!draft.name.trim()}
          className="flex-[2] h-11 rounded-[12px] text-[14px] font-semibold disabled:opacity-40"
          style={{ background: 'var(--mv-ink)', color: 'var(--mv-paper)' }}
        >
          {draft.id ? 'Save' : 'Add habit'}
        </button>
      </div>
    </div>
  );
}

function ArrowIcon({ up }: { up: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function HabitManager() {
  const [habits, setHabits] = useState<Habit[]>(() => loadHabits());
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const refresh = () => setHabits(loadHabits());

  const save = () => {
    if (!draft || !draft.name.trim()) return;
    const cadence: HabitCadence = draft.kind === 'daily'
      ? { kind: 'daily' }
      : { kind: draft.kind, perWeek: draft.perWeek };
    const fields = {
      name: draft.name.trim(),
      cadence,
      heldByDefault: draft.heldByDefault,
      icon: draft.icon,
      color: draft.color,
    };

    if (draft.id) updateHabit(draft.id, fields);
    else addHabit(fields);

    setDraft(null);
    refresh();
  };

  const remove = (id: string) => {
    deleteHabit(id);
    setConfirming(null);
    refresh();
  };

  const dailyCount = habits.filter(h => h.cadence.kind !== 'weekly').length;

  return (
    <div className="px-4">
      {draft
        ? <HabitEditor draft={draft} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} />
        : (
          <button
            onClick={() => setDraft(blankDraft())}
            className="w-full h-12 mb-4 rounded-[13px] text-[15px] font-semibold"
            style={{ background: 'var(--mv-ink)', color: 'var(--mv-paper)' }}
          >
            Add a Habit
          </button>
        )}

      {habits.length === 0 && !draft && (
        <div className="mv-card p-5 text-[13.5px]" style={{ color: 'var(--mv-muted)' }}>
          No habits yet. Today will have nothing to ask you about until you add one.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {habits.map((habit, i) => (
          <div key={habit.id} className="mv-card p-4">
            <div className="flex items-start gap-3">
              <HabitIcon icon={habit.icon} size={22} style={{ color: habitColor(habit), marginTop: 1 }} />
              <div className="flex-grow min-w-0">
                <div className="text-[15px]" style={{ color: 'var(--mv-ink)' }}>{habit.name}</div>
                <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--mv-muted)' }}>
                  {describeCadence(habit.cadence, habit.heldByDefault)}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--mv-muted)' }}>
                <button
                  onClick={() => { moveHabit(habit.id, -1); refresh(); }}
                  disabled={i === 0}
                  aria-label={`Move ${habit.name} up`}
                  className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-25"
                ><ArrowIcon up /></button>
                <button
                  onClick={() => { moveHabit(habit.id, 1); refresh(); }}
                  disabled={i === habits.length - 1}
                  aria-label={`Move ${habit.name} down`}
                  className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-25"
                ><ArrowIcon up={false} /></button>
              </div>
            </div>

            {confirming === habit.id ? (
              <div className="flex items-center gap-2 mt-3">
                <span className="flex-grow text-[12.5px]" style={{ color: 'var(--mv-muted)' }}>
                  Delete {habit.name}? Past logs are kept.
                </span>
                <button
                  onClick={() => setConfirming(null)}
                  className="mv-caps px-2 py-1"
                >Keep</button>
                <button
                  onClick={() => remove(habit.id)}
                  aria-label={`Delete ${habit.name}`}
                  className="mv-caps px-2 py-1"
                  style={{ color: '#b91c1c' }}
                >Delete</button>
              </div>
            ) : (
              <div className="flex gap-4 mt-3">
                <button
                  onClick={() => setDraft(draftFrom(habit))}
                  className="mv-caps"
                  style={{ color: 'var(--mv-ink)' }}
                >Edit</button>
                <button
                  onClick={() => setConfirming(habit.id)}
                  aria-label={`Remove ${habit.name}`}
                  className="mv-caps"
                >Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {habits.length > 0 && (
        <p className="text-[12.5px] leading-relaxed mt-4 px-1" style={{ color: 'var(--mv-muted)' }}>
          Today's ring counts the {dailyCount} habit{dailyCount === 1 ? '' : 's'} due every day.
          Weekly habits carry their debt on their own row instead.
        </p>
      )}
    </div>
  );
}
