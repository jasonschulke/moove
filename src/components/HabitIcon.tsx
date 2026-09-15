/**
 * A habit's icon.
 *
 * Material Symbols, which the app already loads for the rest of its icons.
 * The font arrives over the network, and an icon font has a failure mode worth
 * guarding: until the glyph is available the browser renders the ligature with
 * whatever font it does have, so the row reads "directions_walk" in words.
 * `display=block` only delays that, it does not prevent it, and on a phone
 * with no signal the words are what you get. Moove is a PWA, so that case is
 * real.
 *
 * So the glyph is held back until the font reports itself loaded. Offline, a
 * habit simply shows no icon, which is tidy; online, the icon appears as soon
 * as the font lands. A habit with no icon set draws nothing either way.
 */

import { useEffect, useState } from 'react';

/**
 * Whether the icon font is actually rendering glyphs.
 *
 * document.fonts.check() is not the test: when the stylesheet fails to load at
 * all there is no @font-face to fail against, so it reports the family as
 * satisfiable and returns true while the browser renders plain text. Measuring
 * is the direct question. A ligature collapses to one glyph when the font is
 * active, so the probe is far narrower than the same characters in the
 * fallback; if the two measure the same, the font is not there.
 */
function iconFontActive(): boolean {
  if (typeof document === 'undefined' || !document.body) return false;

  const measure = (family: string): number => {
    const el = document.createElement('span');
    el.textContent = 'directions_walk';
    el.setAttribute('style',
      `position:absolute;left:-9999px;top:-9999px;font-size:48px;` +
      `white-space:nowrap;font-family:${family}`);
    document.body.appendChild(el);
    const width = el.getBoundingClientRect().width;
    el.remove();
    return width;
  };

  try {
    return measure('"Material Symbols Outlined", monospace') !== measure('monospace');
  } catch {
    return false;
  }
}

let ready = false;
const waiting = new Set<(v: boolean) => void>();

function announce(value: boolean) {
  ready = value;
  for (const w of waiting) w(value);
  if (value) waiting.clear();
}

function subscribe(fn: (v: boolean) => void): () => void {
  if (ready || iconFontActive()) {
    ready = true;
    fn(true);
    return () => {};
  }

  waiting.add(fn);
  // One watcher for the whole app, however many icons are on screen.
  if (waiting.size === 1) {
    document.fonts?.ready
      .then(() => announce(iconFontActive()))
      // Offline, the icons stay hidden rather than showing their own names.
      .catch(() => { /* no icons */ });
  }
  return () => { waiting.delete(fn); };
}

interface HabitIconProps {
  icon?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function HabitIcon({ icon, size = 20, className = '', style }: HabitIconProps) {
  const [shown, setShown] = useState(() => ready);

  useEffect(() => (shown ? undefined : subscribe(setShown)), [shown]);

  if (!icon) return null;

  return (
    <span
      aria-hidden="true"
      data-icon={icon}
      className={`material-symbols-outlined flex-shrink-0 ${className}`}
      style={{
        fontSize: `${size}px`,
        lineHeight: 1,
        // A flex item will not shrink below its content by default, and an
        // unrendered ligature is a long string, so the box has to be pinned at
        // every edge or a hidden icon still shoves the row across.
        width: size,
        minWidth: size,
        maxWidth: size,
        height: size,
        overflow: 'hidden',
        // Held back, but still holding its place, so nothing shifts when the
        // font lands.
        visibility: shown ? 'visible' : 'hidden',
        ...style,
      }}
    >
      {icon}
    </span>
  );
}
