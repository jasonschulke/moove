import { describe, it, expect } from 'vitest';
import { rampColor, completionColor, scoreColor } from './completionColor';

const GREEN = '#047857';

describe('rampColor', () => {
  it('lands on each named stop', () => {
    expect(rampColor(0.25, GREEN)).toBe('#b91c1c');
    expect(rampColor(0.5, GREEN)).toBe('#ca8a04');
    expect(rampColor(0.75, GREEN)).toBe('#5a9e54');
    expect(rampColor(1, GREEN)).toBe(GREEN);
  });

  it('keeps anything at or under a quarter red', () => {
    expect(rampColor(0, GREEN)).toBe('#b91c1c');
    expect(rampColor(0.1, GREEN)).toBe('#b91c1c');
    expect(rampColor(1 / 6, GREEN)).toBe('#b91c1c');
  });

  it('interpolates between stops rather than stepping', () => {
    const mid = rampColor(0.375, GREEN);
    expect(mid).not.toBe('#b91c1c');
    expect(mid).not.toBe('#ca8a04');
  });

  it('is driven by the fraction, so the count does not matter', () => {
    // Three of four and six of eight are the same day, differently counted.
    expect(rampColor(3 / 4, GREEN)).toBe(rampColor(6 / 8, GREEN));
    // A full day is the full green whatever the denominator, which is what
    // keeps a weekly habit from knocking the colour backwards: it widens both
    // halves of the fraction at once.
    expect(rampColor(4 / 4, GREEN)).toBe(rampColor(5 / 5, GREEN));
  });

  it('never leaves the ramp', () => {
    expect(rampColor(-1, GREEN)).toBe('#b91c1c');
    expect(rampColor(2, GREEN)).toBe(GREEN);
  });

  it('takes the top colour it is given, so dark mode can pass its own', () => {
    expect(rampColor(1, '#10b981')).toBe('#10b981');
  });

  it('falls back to the light green when the theme has no token', () => {
    expect(completionColor(1)).toBe(GREEN);
  });
});

describe('scoreColor', () => {
  it('reads a count', () => {
    expect(scoreColor(3, 4)).toBe(rampColor(0.75, GREEN));
  });

  it('treats a day with nothing tracked as the bottom of the ramp', () => {
    expect(scoreColor(0, 0)).toBe('#b91c1c');
  });
});
