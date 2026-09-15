import { describe, it, expect, beforeEach } from 'vitest';
import { say, SITUATIONS } from './voice';
import type { Situation } from './voice';
import { PERSONALITY_OPTIONS } from '../types';
import type { PersonalityType } from '../types';

const VOICES = PERSONALITY_OPTIONS.map(o => o.value);

const FULL_CONTEXT = {
  open: 2, total: 3, owed: 3, daysLeft: 6,
  habit: 'Run', closed: 4, counted: 5,
};

beforeEach(() => { localStorage.clear(); });

describe('coverage', () => {
  it('covers every situation in every voice', () => {
    for (const situation of SITUATIONS) {
      for (const voice of VOICES) {
        const line = say(situation, FULL_CONTEXT, voice, '2026-09-15');
        expect(line, `${situation}/${voice}`).toBeTruthy();
      }
    }
  });

  it('leaves no placeholder unresolved', () => {
    for (const situation of SITUATIONS) {
      for (const voice of VOICES) {
        // Walk a fortnight so every variant in every cell is exercised.
        for (let day = 1; day <= 14; day++) {
          const on = `2026-09-${String(day).padStart(2, '0')}`;
          const line = say(situation, FULL_CONTEXT, voice, on);
          expect(line, `${situation}/${voice}/${on}`).not.toMatch(/\{\w+\}/);
        }
      }
    }
  });

  it('gives every cell more than one variant', () => {
    for (const situation of SITUATIONS) {
      for (const voice of VOICES) {
        const seen = new Set<string>();
        for (let day = 1; day <= 28; day++) {
          seen.add(say(situation, FULL_CONTEXT, voice, `2026-09-${String(day).padStart(2, '0')}`));
        }
        expect(seen.size, `${situation}/${voice} only said "${[...seen][0]}"`).toBeGreaterThan(1);
      }
    }
  });

  it('ends every line as a sentence', () => {
    for (const situation of SITUATIONS) {
      for (const voice of VOICES) {
        const line = say(situation, FULL_CONTEXT, voice, '2026-09-15');
        expect(line, `${situation}/${voice}: "${line}"`).toMatch(/[.!?]$/);
      }
    }
  });
});

describe('determinism', () => {
  it('says the same thing all day', () => {
    const a = say('dayPartial', FULL_CONTEXT, 'zen', '2026-09-15');
    const b = say('dayPartial', FULL_CONTEXT, 'zen', '2026-09-15');
    expect(a).toBe(b);
  });

  it('turns over across a fortnight', () => {
    const lines = new Set<string>();
    for (let day = 1; day <= 14; day++) {
      lines.add(say('dayPartial', FULL_CONTEXT, 'zen', `2026-09-${String(day).padStart(2, '0')}`));
    }
    expect(lines.size).toBeGreaterThan(1);
  });

  it('varies by the habit it is talking about', () => {
    const run = say('weekGap', { ...FULL_CONTEXT, habit: 'Run' }, 'neutral', '2026-09-15');
    const lift = say('weekGap', { ...FULL_CONTEXT, habit: 'Lift' }, 'neutral', '2026-09-15');
    expect(run).not.toBe(lift);
  });

  it('gives different voices different words', () => {
    const zen = say('dayEmpty', FULL_CONTEXT, 'zen', '2026-09-15');
    const rude = say('dayEmpty', FULL_CONTEXT, 'rude', '2026-09-15');
    expect(zen).not.toBe(rude);
  });
});

describe('substitution', () => {
  it('drops the numbers in', () => {
    const line = say('debtComfortable', { owed: 3, daysLeft: 6 }, 'neutral', '2026-09-15');
    expect(line).toMatch(/3/);
    expect(line).toMatch(/6/);
  });

  it('names the habit in a verdict, in either case', () => {
    const line = say('weekZero', { closed: 4, counted: 5, habit: 'Run' }, 'neutral', '2026-09-15');
    expect(line).toMatch(/run/i);
  });
});

describe('the stored preference', () => {
  it('follows what Settings saved', () => {
    localStorage.setItem('workout_personality', 'rude');
    const stored = say('dayEmpty', FULL_CONTEXT, undefined, '2026-09-15');
    const explicit = say('dayEmpty', FULL_CONTEXT, 'rude', '2026-09-15');
    expect(stored).toBe(explicit);
  });

  it('falls back to neutral when nothing is saved', () => {
    const stored = say('dayEmpty', FULL_CONTEXT, undefined, '2026-09-15');
    const neutral = say('dayEmpty', FULL_CONTEXT, 'neutral', '2026-09-15');
    expect(stored).toBe(neutral);
  });

  it('falls back to neutral for an unknown voice', () => {
    const line = say('dayEmpty', FULL_CONTEXT, 'nonsense' as PersonalityType, '2026-09-15');
    expect(line).toBe(say('dayEmpty', FULL_CONTEXT, 'neutral', '2026-09-15'));
  });
});

describe('the situation list', () => {
  it('matches what Today and Insights ask for', () => {
    const expected: Situation[] = [
      'dayEmpty', 'dayPartial', 'dayClosed', 'dayRest',
      'debtComfortable', 'debtTight', 'debtLastDay', 'dailyOpen',
      'allSettled',
      'weekPerfect', 'weekGap', 'weekZero', 'weekNotStarted',
    ];
    expect(SITUATIONS.sort()).toEqual(expected.sort());
  });
});

describe('agreement', () => {
  // The numbers these lines quote are often 1, and "1 remain" or "1 days"
  // reads as a bug even when the logic behind it is right.
  const BAD = /\b1 (days|are|remain|habits)\b/i;

  it('never says "1 days" or "1 remain", in any voice on any day', () => {
    const ones = { open: 1, total: 1, owed: 1, daysLeft: 1, closed: 1, counted: 1, habit: 'Run' };
    for (const situation of SITUATIONS) {
      for (const voice of VOICES) {
        for (let day = 1; day <= 28; day++) {
          const line = say(situation, ones, voice, `2026-09-${String(day).padStart(2, '0')}`);
          expect(line, `${situation}/${voice}: "${line}"`).not.toMatch(BAD);
        }
      }
    }
  });

  it('agrees the verb with the number', () => {
    expect(say('dayPartial', { open: 1 }, 'zen', '2026-09-16')).not.toMatch(BAD);
    expect(say('dayPartial', { open: 2 }, 'zen', '2026-09-16')).not.toMatch(/\b2 is\b/);
  });

  it('lowercases the habit where a line reads better for it', () => {
    const lines = [];
    for (let day = 1; day <= 28; day++) {
      lines.push(say('weekZero', { closed: 1, counted: 2, habit: 'Lift' }, 'neutral', `2026-09-${String(day).padStart(2, '0')}`));
    }
    expect(lines.some(l => l.includes(' lift'))).toBe(true);
  });
});

describe('sounding like a person', () => {
  const ALL = () => {
    const lines = [];
    for (const situation of SITUATIONS) {
      for (const voice of VOICES) {
        for (let day = 1; day <= 28; day++) {
          lines.push({
            situation, voice,
            text: say(situation, FULL_CONTEXT, voice, `2026-09-${String(day).padStart(2, '0')}`),
          });
        }
      }
    }
    return lines;
  };

  it('contracts where people contract', () => {
    // Avoiding contractions is the single loudest tell. These are the forms
    // that read as written-not-spoken wherever they appear.
    // Trailing \s+\w matters: "ready when you are." is correct English and
    // cannot be contracted at a clause end, so only mid-sentence forms count.
    const stilted = /\b(do not|did not|does not|is not|are not|have not|has not|will not|cannot|it is|I am|you are|that is|there is|let us)\s+\w/i;
    const offenders = ALL().filter(l => stilted.test(l.text));
    expect(offenders.map(o => `${o.voice}: ${o.text}`).slice(0, 5)).toEqual([]);
  });

  it('keeps each voice its own words', () => {
    // A line appearing in two voices means neither one owns it.
    const byText = new Map();
    for (const { voice, text } of ALL()) {
      if (!byText.has(text)) byText.set(text, new Set());
      byText.get(text).add(voice);
    }
    const shared = [...byText.entries()].filter(([, voices]) => voices.size > 1);
    expect(shared.map(([text, voices]) => `"${text}" in ${[...voices].join(' + ')}`)).toEqual([]);
  });

  it('stays short enough to read at a glance', () => {
    const long = ALL().filter(l => l.text.length > 72);
    expect(long.map(l => `${l.voice}: ${l.text}`)).toEqual([]);
  });
});
