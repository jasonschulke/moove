/**
 * The colour of a completion score.
 *
 * A day that is a quarter done and a day that is finished should not be the
 * same green. The ramp runs red, amber, light green, green, and it is driven
 * by the fraction rather than the count, so it holds however many habits you
 * track: four of four and six of six are both the full green, and doing a
 * weekly habit, which widens the day by one on both sides, keeps the colour
 * where it was rather than knocking it backwards.
 *
 * Anything at or under a quarter is red. There is no colour for zero, because
 * a zero score draws no arc and no bar.
 */

/** Fraction, colour. Interpolated between; clamped outside. */
const STOPS: [number, string][] = [
  [0.25, '#b91c1c'], // the red already used for destructive actions
  [0.50, '#ca8a04'], // amber
  [0.75, '#5a9e54'], // light green
  [1.00, '#047857'], // replaced by the theme's own green at call time
];

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/**
 * The pure ramp, with the top colour passed in. Split out from the theme
 * lookup so it can be reasoned about, and tested, without a document.
 */
export function rampColor(fraction: number, topColor: string): string {
  const stops = STOPS.map(([at, hex], i) =>
    [at, i === STOPS.length - 1 ? topColor : hex] as [number, string]);

  if (fraction <= stops[0][0]) return stops[0][1];
  if (fraction >= 1) return stops[stops.length - 1][1];

  for (let i = 1; i < stops.length; i++) {
    const [hiAt, hiHex] = stops[i];
    if (fraction > hiAt) continue;
    const [loAt, loHex] = stops[i - 1];
    const lo = parseHex(loHex);
    const hi = parseHex(hiHex);
    if (!lo || !hi) return hiHex;
    const t = (fraction - loAt) / (hiAt - loAt);
    return toHex([0, 1, 2].map(c => lo[c] + (hi[c] - lo[c]) * t) as [number, number, number]);
  }
  return stops[stops.length - 1][1];
}

/**
 * The app's green for whichever theme is showing. Read rather than hardcoded,
 * because dark mode uses a brighter green and a full day has to land exactly
 * on it rather than near it.
 */
export function themeGreen(): string {
  if (typeof document === 'undefined') return '#047857';
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--mv-green').trim();
    return parseHex(value) ? value : '#047857';
  } catch {
    return '#047857';
  }
}

/** The colour for a completion fraction, in the current theme. */
export function completionColor(fraction: number): string {
  return rampColor(fraction, themeGreen());
}

/** The same, from a count. Zero total means nothing tracked, so no colour. */
export function scoreColor(completed: number, total: number): string {
  return completionColor(total > 0 ? completed / total : 0);
}
