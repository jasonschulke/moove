/**
 * Checks the tone-of-voice setting actually reaches the screen.
 *
 *   npm run build
 *   npx vite preview --port 4173 &
 *   node scripts/smoke-voice.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173';
const VOICES = ['neutral', 'sarcastic', 'encouraging', 'rude', 'zen', 'flirty'];
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));

await page.goto(BASE, { waitUntil: 'networkidle' });

const spoken = {};
for (const voice of VOICES) {
  await page.evaluate(v => {
    localStorage.clear();
    localStorage.setItem('workout_onboarding_complete', 'true');
    localStorage.setItem('workout_personality', v);
    localStorage.setItem('habit_logs', JSON.stringify({
      '2026-09-14': { walk: true, dog: true },
      '2026-09-15': { walk: true },
    }));
  }, voice);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);

  // Today's Next card is gone, so the voice speaks twice: beside the ring,
  // and as the week's verdict on Insights.
  const ring = await page.locator('.mv-card .text-\\[14px\\]').first().innerText();
  await page.getByRole('button', { name: 'Insights', exact: true }).click();
  await page.waitForTimeout(700);
  const verdict = await page.locator('.mv-serif').first().innerText();

  spoken[voice] = { ring, verdict };
  check(`${voice} fills both lines`,
    [ring, verdict].every(l => l.trim().length > 0),
    `${ring} / ${verdict}`);
  check(`${voice} leaves no placeholder`,
    ![ring, verdict].some(l => /\{\w+\}/.test(l)),
    `${ring} / ${verdict}`);
}

for (const slot of ['ring', 'verdict']) {
  const distinct = new Set(VOICES.map(v => spoken[v][slot]));
  check(`the ${slot} differs across voices`, distinct.size >= 5, `${distinct.size} of 6 distinct`);
}

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
