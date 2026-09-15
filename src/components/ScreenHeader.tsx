/**
 * The header every screen shares: the mark and the screen's wordmark. Nothing
 * is drawn under or over it; the cards below carry the structure.
 *
 * `wordmark` is a path in public/. Screens without artwork pass `label`
 * instead, set to match the artwork's cap height rather than the caption size
 * it used to borrow, which left one screen's name visibly smaller than the
 * rest.
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
