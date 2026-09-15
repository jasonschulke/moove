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
import {
  loadHabits, addHabit, updateHabit, deleteHabit, moveHabitAmong,
  describeCadence, habitColor, HABIT_UNITS,
} from '../data/habits';
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
  'weekly': 'Owed a number of times a week, on no particular day. Counts toward the day ring on the days you do it.',
};

interface DraftState {
  id: string | null;
  name: string;
  kind: CadenceKind;
  perWeek: number;
  heldByDefault: boolean;
  icon: string | undefined;
  color: string | undefined;
  /** Records a number rather than a tick. */
  measured: boolean;
  unit: string;
  /** Kept as text while editing, so a half-typed number is not a value yet. */
  target: string;
  direction: 'atLeast' | 'atMost';
  /** Carried through untouched. Only the seeded weight habit has one. */
  source: 'bodyWeight' | undefined;
}

const blankDraft = (): DraftState => ({
  id: null, name: '', kind: 'daily', perWeek: 3, heldByDefault: false,
  icon: undefined, color: undefined,
  measured: false, unit: '', target: '', direction: 'atLeast', source: undefined,
});

const draftFrom = (habit: Habit): DraftState => ({
  id: habit.id,
  name: habit.name,
  kind: habit.cadence.kind,
  perWeek: habit.cadence.kind === 'daily' ? 3 : habit.cadence.perWeek,
  heldByDefault: habit.heldByDefault,
  icon: habit.icon,
  color: habit.color,
  measured: Boolean(habit.unit),
  unit: habit.unit ?? '',
  target: habit.target === undefined ? '' : String(habit.target),
  direction: habit.targetDirection ?? 'atLeast',
  source: habit.source,
});

function HabitEditor({ draft, onChange, onSave, onCancel, onDelete }: {
  draft: DraftState;
  onChange: (d: DraftState) => void;
  onSave: () => void;
  onCancel: () => void;
  /** Absent for a habit that does not exist yet. */
  onDelete?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const needsCount = draft.kind !== 'daily';
  const hasTarget = draft.target.trim().length > 0;
  const unitLabel = draft.unit.trim() || 'the unit';

  return (
    <div>
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
        onClick={() => onChange({ ...draft, measured: !draft.measured })}
        aria-pressed={draft.measured}
        aria-label="Record a number"
        className="w-full text-left px-3 py-2.5 mb-3 rounded-[10px]"
        style={{
          border: `1.5px solid ${draft.measured ? 'var(--mv-green)' : 'var(--mv-track)'}`,
          color: 'var(--mv-ink)',
        }}
      >
        <span className="block text-[14px]">Record a number</span>
        <span className="block text-[12px] mt-0.5" style={{ color: 'var(--mv-muted)' }}>
          Tapping it on Today opens a field rather than a tick box, and Insights charts it.
        </span>
      </button>

      {draft.measured && (
        <div className="px-3 py-3 mb-3 rounded-[10px]" style={{ border: '1.5px solid var(--mv-track)' }}>
          <div className="mv-caps mb-2">Unit</div>
          <input
            type="text"
            value={draft.unit}
            onChange={e => onChange({ ...draft, unit: e.target.value })}
            placeholder="lb"
            aria-label="Unit"
            maxLength={8}
            className="w-full px-3 h-10 rounded-[10px] text-[15px] bg-transparent outline-none"
            style={{ border: '1.5px solid var(--mv-track)', color: 'var(--mv-ink)' }}
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {HABIT_UNITS.map(u => (
              <button
                key={u}
                onClick={() => onChange({ ...draft, unit: u })}
                aria-label={`Unit ${u}`}
                aria-pressed={draft.unit.trim() === u}
                className="px-2.5 h-7 rounded-full text-[12.5px]"
                style={
                  draft.unit.trim() === u
                    ? { background: 'var(--mv-green)', color: '#ffffff' }
                    : { border: '1.5px solid var(--mv-track)', color: 'var(--mv-muted)' }
                }
              >{u}</button>
            ))}
          </div>

          <div className="mv-caps mt-4 mb-2">Goal</div>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={draft.target}
            onChange={e => onChange({ ...draft, target: e.target.value })}
            placeholder="Optional"
            aria-label="Goal"
            className="mv-number w-full px-3 h-10 rounded-[10px] text-[15px] bg-transparent outline-none"
            style={{ border: '1.5px solid var(--mv-track)', color: 'var(--mv-ink)' }}
          />

          {hasTarget && (
            <div className="flex gap-1.5 mt-2">
              {([['atLeast', 'At least'], ['atMost', 'At most']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => onChange({ ...draft, direction: value })}
                  aria-pressed={draft.direction === value}
                  className="flex-1 h-9 rounded-[10px] text-[13px]"
                  style={
                    draft.direction === value
                      ? { background: 'var(--mv-green)', color: '#ffffff' }
                      : { border: '1.5px solid var(--mv-track)', color: 'var(--mv-ink)' }
                  }
                >{label}</button>
              ))}
            </div>
          )}

          <p className="text-[12px] mt-2 leading-relaxed" style={{ color: 'var(--mv-muted)' }}>
            {hasTarget
              ? `Drawn across the chart, and marked ${draft.direction === 'atMost' ? 'down' : 'up'} to ${draft.target.trim()} ${unitLabel} as progress. Taking the reading is what completes the task, so a goal months away never holds today open.`
              : 'A goal is drawn on the chart and nothing more. Taking the reading is what completes the task.'}
          </p>

          {draft.source === 'bodyWeight' && (
            <p className="text-[12px] mt-2 leading-relaxed" style={{ color: 'var(--mv-muted)' }}>
              Readings here go to your weight history, which the chart draws and
              Health imports write to.
            </p>
          )}
        </div>
      )}

      {!draft.measured && (
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
      )}

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
          disabled={!draft.name.trim() || (draft.measured && !draft.unit.trim())}
          className="flex-[2] h-11 rounded-[12px] text-[14px] font-semibold disabled:opacity-40"
          style={{ background: 'var(--mv-ink)', color: 'var(--mv-paper)' }}
        >
          {draft.id ? 'Save' : 'Add habit'}
        </button>
      </div>

      {/* Deleting is an edit, so it lives with the other edits rather than
          beside the habit where a stray tap can reach it. */}
      {onDelete && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--mv-hairline)' }}>
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="flex-grow text-[12.5px]" style={{ color: 'var(--mv-muted)' }}>
                Stop tracking {draft.name.trim() || 'this habit'}? Past weeks keep it.
              </span>
              <button onClick={() => setConfirming(false)} className="mv-caps px-2 py-1">Keep</button>
              <button
                onClick={onDelete}
                aria-label={`Delete ${draft.name.trim()}`}
                className="mv-caps px-2 py-1"
                style={{ color: '#b91c1c' }}
              >Delete</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              aria-label={`Remove ${draft.name.trim()}`}
              className="mv-caps"
            >Stop tracking this habit</button>
          )}
        </div>
      )}
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

function GearIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/**
 * One habit at rest.
 *
 * The whole card is the edit control. Two text buttons per row made a list of
 * six habits read as twelve actions, and a gear to reveal them was a tap that
 * bought nothing. The reorder arrows stay behind the page's own gear, since
 * you reorder once and then never again.
 */
function HabitCard({ habit, reordering, canUp, canDown, onEdit, onMove }: {
  habit: Habit;
  reordering: boolean;
  canUp: boolean;
  canDown: boolean;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const body = (
    <>
      <HabitIcon icon={habit.icon} size={22} style={{ color: habitColor(habit) }} />
      <span className="flex-grow min-w-0 text-[15px] truncate" style={{ color: 'var(--mv-ink)' }}>
        {habit.name}
      </span>
      <span className="flex-shrink-0 text-[12.5px] text-right" style={{ color: 'var(--mv-muted)' }}>
        {describeCadence(habit.cadence, habit.heldByDefault)}
      </span>
    </>
  );

  if (reordering) {
    return (
      <div className="mv-card flex items-center gap-3 px-4 py-3.5">
        {body}
        <span className="flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--mv-muted)' }}>
          <button
            onClick={() => onMove(-1)}
            disabled={!canUp}
            aria-label={`Move ${habit.name} up`}
            className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-25"
          ><ArrowIcon up /></button>
          <button
            onClick={() => onMove(1)}
            disabled={!canDown}
            aria-label={`Move ${habit.name} down`}
            className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-25"
          ><ArrowIcon up={false} /></button>
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={onEdit}
      aria-label={`Edit ${habit.name}`}
      className="mv-card w-full flex items-center gap-3 px-4 py-3.5 text-left active:scale-[0.99] transition-transform"
    >
      {body}
    </button>
  );
}

export function HabitManager() {
  const [habits, setHabits] = useState<Habit[]>(() => loadHabits());
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [pageMenu, setPageMenu] = useState(false);
  const [reordering, setReordering] = useState(false);

  const refresh = () => setHabits(loadHabits());

  const save = () => {
    if (!draft || !draft.name.trim()) return;
    const cadence: HabitCadence = draft.kind === 'daily'
      ? { kind: 'daily' }
      : { kind: draft.kind, perWeek: draft.perWeek };

    // A half-typed target is not a number yet, and a measured habit cannot
    // also be held: there is nothing to hold when the day asks for a reading.
    const unit = draft.measured ? draft.unit.trim() : '';
    const parsed = parseFloat(draft.target);
    const target = unit && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;

    const fields = {
      name: draft.name.trim(),
      cadence,
      heldByDefault: unit ? false : draft.heldByDefault,
      icon: draft.icon,
      color: draft.color,
      unit: unit || undefined,
      // Carried through even with the unit off. Everything that reads a source
      // checks for a unit first, so a dormant one does nothing, and keeping it
      // means turning measuring back on relinks weight to its own history
      // rather than starting a second, empty one in the habit log.
      source: draft.source,
      target,
      targetDirection: target === undefined ? undefined : draft.direction,
    };

    if (draft.id) updateHabit(draft.id, fields);
    else addHabit(fields);

    setDraft(null);
    refresh();
  };

  const remove = (id: string) => {
    deleteHabit(id);
    setDraft(null);
    refresh();
  };

  // Daily and weekly are different promises, and reading them as one list made
  // a weekly habit look like something you had failed to do today.
  const groups = [
    { key: 'daily', label: 'Daily', habits: habits.filter(h => h.cadence.kind !== 'weekly') },
    { key: 'weekly', label: 'Weekly', habits: habits.filter(h => h.cadence.kind === 'weekly') },
  ].filter(g => g.habits.length > 0);

  const dailyCount = habits.filter(h => h.cadence.kind !== 'weekly').length;

  return (
    <div className="px-4">
      {draft && !draft.id ? (
        <div className="mv-card p-4 mb-4">
          <HabitEditor draft={draft} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} />
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => { setDraft(blankDraft()); setReordering(false); setPageMenu(false); }}
            className="flex-grow h-12 rounded-[13px] text-[15px] font-semibold"
            style={{ background: 'var(--mv-ink)', color: 'var(--mv-paper)' }}
          >
            Add a Habit
          </button>
          <button
            onClick={() => setPageMenu(o => !o)}
            aria-label="Habit list options"
            aria-expanded={pageMenu}
            className="w-12 h-12 flex items-center justify-center rounded-[13px] flex-shrink-0"
            style={{ border: '1.5px solid var(--mv-hairline)', color: 'var(--mv-ink)' }}
          ><GearIcon size={19} /></button>
        </div>
      )}

      {pageMenu && (
        <div className="mv-card p-2 mb-4">
          <button
            onClick={() => { setReordering(r => !r); setPageMenu(false); setDraft(null); }}
            className="w-full text-left px-3 py-2.5 text-[14px]"
            style={{ color: 'var(--mv-ink)' }}
          >
            {reordering ? 'Finish reordering' : 'Reorder habits'}
          </button>
        </div>
      )}

      {reordering && !pageMenu && (
        <button
          onClick={() => setReordering(false)}
          className="w-full h-10 mb-4 rounded-[12px] text-[13px] font-medium"
          style={{ border: '1.5px solid var(--mv-hairline)', color: 'var(--mv-muted)' }}
        >Finish reordering</button>
      )}

      {habits.length === 0 && !draft && (
        <div className="mv-card p-5 text-[13.5px]" style={{ color: 'var(--mv-muted)' }}>
          No habits yet. Today will have nothing to ask you about until you add one.
        </div>
      )}

      {groups.map(group => {
        const ids = group.habits.map(h => h.id);
        return (
          <section key={group.key} className="mb-5">
            <div className="mv-caps mx-1 mb-2">{group.label}</div>
            <div className="flex flex-col gap-2">
              {group.habits.map((habit, i) => (
                draft?.id === habit.id ? (
                  <div key={habit.id} className="mv-card p-4">
                    <HabitEditor
                      draft={draft}
                      onChange={setDraft}
                      onSave={save}
                      onCancel={() => setDraft(null)}
                      onDelete={() => remove(habit.id)}
                    />
                  </div>
                ) : (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    reordering={reordering}
                    canUp={i > 0}
                    canDown={i < group.habits.length - 1}
                    onEdit={() => setDraft(draftFrom(habit))}
                    onMove={dir => { moveHabitAmong(habit.id, dir, ids); refresh(); }}
                  />
                )
              ))}
            </div>
          </section>
        );
      })}

      {habits.length > 0 && (
        <p className="text-[12.5px] leading-relaxed mt-1 px-1" style={{ color: 'var(--mv-muted)' }}>
          Today's ring counts the {dailyCount} habit{dailyCount === 1 ? '' : 's'} due every day.
          A weekly habit joins it only on the days you do one, so it can add to a day but never dilute it.
        </p>
      )}
    </div>
  );
}
