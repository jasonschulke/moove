/**
 * Picks a habit's icon from a curated grid.
 *
 * Curated rather than a search over the whole Material set: the point is a
 * glanceable row on Today, and thirty-six good choices get there faster than
 * three thousand. "None" is a real option, so an icon is never forced.
 */

import { HABIT_ICON_GROUPS, HABIT_COLORS } from '../data/habits';
import { HabitIcon } from './HabitIcon';

interface IconPickerProps {
  value?: string;
  onChange: (icon: string | undefined) => void;
  color?: string;
  onColorChange: (color: string | undefined) => void;
}

export function IconPicker({ value, onChange, color, onColorChange }: IconPickerProps) {
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

      <div className="mv-caps mt-3 mb-2">Colour</div>
      <div className="flex flex-wrap gap-2">
        {HABIT_COLORS.map(c => (
          <button
            key={c.key}
            type="button"
            onClick={() => onColorChange(color === c.key ? undefined : c.key)}
            aria-label={c.label}
            aria-pressed={color === c.key}
            className="rounded-full"
            style={{
              width: 30,
              height: 30,
              background: c.value,
              // The chosen one wears a ring drawn outside itself, so the
              // swatch stays a full circle of its own colour.
              boxShadow: color === c.key
                ? '0 0 0 2px var(--mv-paper), 0 0 0 4px var(--mv-ink)'
                : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}
