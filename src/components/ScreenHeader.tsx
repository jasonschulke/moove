/**
 * The header every screen shares: the mark and the screen's wordmark. Nothing
 * is drawn under or over it; the cards below carry the structure.
 *
 * `wordmark` is a path in public/. Every screen has artwork now, including
 * Insights, whose wordmark is built from the letterforms in the others rather
 * than set in a system face that never matched. `label` remains as a fallback
 * for a screen added without artwork, sized to the artwork's cap height so it
 * is at least the right size when it is the wrong font.
 */

interface ScreenHeaderProps {
  wordmark?: string;
  label?: string;
  alt: string;
  /** Rendered at the right of the header row, baseline-aligned. */
  trailing?: React.ReactNode;
}

export function ScreenHeader({ wordmark, label, alt, trailing }: ScreenHeaderProps) {
  return (
    <>
      <header className="px-4 pt-14 pb-3 safe-top flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <img src="/logo_icon.png" alt="Moove" className="h-9 dark:invert" />
          {wordmark
            ? <img src={wordmark} alt={alt} className="h-5 dark:invert" />
            : <span style={{
                fontSize: 25,
                lineHeight: '20px',
                fontWeight: 800,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: 'var(--mv-ink)',
              }}>{label ?? alt}</span>}
        </div>
        {trailing}
      </header>
    </>
  );
}
