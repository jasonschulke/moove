/**
 * Picks a habit's icon from a curated grid.
 *
 * Curated rather than a search over the whole Material set: the point is a
 * glanceable row on Today, and thirty-six good choices get there faster than
 * three thousand. "None" is a real option, so an icon is never forced.
 */

import { HABIT_ICON_GROUPS } from '../data/habits';
import { HabitIcon } from './HabitIcon';

interface IconPickerProps {
  value?: string;
  onChange: (icon: string | undefined) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const cell = (icon: string | undefined, key: string, label: string) => {
    const selected = value === icon;
    return (
      <button
        key={key}
        type="button"
        onClick={() => onChange(icon)}
        aria-label={label}
        aria-pressed={selected}
        className="flex items-center justify-center rounded-[10px] h-11 transition-colors"
        style={{
          border: `1.5px solid ${selected ? 'var(--mv-green)' : 'var(--mv-track)'}`,
          color: selected ? 'var(--mv-green)' : 'var(--mv-ink)',
          background: selected ? 'rgba(4, 120, 87, 0.07)' : 'transparent',
        }}
      >
        {icon
          ? <HabitIcon icon={icon} size={22} />
          : <span className="mv-caps" style={{ color: 'inherit' }}>None</span>}
      </button>
    );
  };

  return (
    <div>
      <div className="mv-caps mb-2">Icon</div>
      {/* Thirty-six cells and four headings run to about eight hundred pixels,
          which would push Add habit off the bottom of a phone. Scrolling the
          grid keeps every choice reachable and the buttons in reach too. */}
      <div
        className="rounded-[10px] p-2"
        style={{ maxHeight: 208, overflowY: 'auto', border: '1.5px solid var(--mv-track)' }}
      >
        <div className="grid grid-cols-5 gap-1.5 mb-2">
          {cell(undefined, 'none', 'No icon')}
        </div>
        {HABIT_ICON_GROUPS.map(group => (
          <div key={group.label} className="mb-2 last:mb-0">
            <div className="text-[11px] mb-1.5" style={{ color: 'var(--mv-faint)' }}>{group.label}</div>
            <div className="grid grid-cols-5 gap-1.5">
              {group.icons.map(icon => cell(icon, icon, icon.replace(/_/g, ' ')))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
