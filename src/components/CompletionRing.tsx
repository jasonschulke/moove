/**
 * The day's completion, as one arc.
 *
 * A single score rather than per-habit segments, so adding a fourth tracked
 * thing later does not mean redesigning the calendar that reuses this shape.
 */

interface CompletionRingProps {
  completed: number;
  total: number;
  /** Outer diameter in px. */
  size?: number;
}

export function CompletionRing({ completed, total, size = 128 }: CompletionRingProps) {
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0;
  const offset = circumference * (1 - fraction);

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${completed} of ${total} done today`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="var(--mv-track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="var(--mv-green)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 0.8, 0.3, 1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="mv-serif leading-none"
          style={{ fontSize: size * 0.3, color: 'var(--mv-ink)' }}>
          {completed}<span style={{ color: 'var(--mv-faint)' }}>/{total}</span>
        </span>
      </div>
    </div>
  );
}
