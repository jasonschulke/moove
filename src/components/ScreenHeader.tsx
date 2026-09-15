/**
 * The header every screen shares: the mark, the screen's wordmark, and the
 * black rule under them. Black is structure, so the rule replaces the hairline
 * border the screens used to carry.
 *
 * `wordmark` is a path in public/. Screens without artwork pass `label`
 * instead and get the same shape in type.
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
            : <span className="mv-caps" style={{ fontSize: 13, letterSpacing: '2px', color: 'var(--mv-ink)' }}>{label ?? alt}</span>}
        </div>
        {trailing}
      </header>
      <div className="mv-rule mx-4" />
    </>
  );
}
