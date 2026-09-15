/**
 * Boots the built app in Chromium and checks the Today screen behaves.
 *
 *   npm run build
 *   npx vite preview --port 4173 &
 *   node scripts/smoke-today.mjs
 *
 * SMOKE_URL overrides the address; CHROME_PATH overrides the browser binary
 * (needed in sandboxes that ship their own Chromium).
 */
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173';
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));

const ring = () => page.locator('[role="img"][aria-label$="done today"]').first();
const settle = () => page.waitForTimeout(2600); // 2s splash, then render

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await settle();

// ---------------------------------------------------------------- onboarding
// A fresh install walks the tour first. It must describe the nav that exists.
check('onboarding opens on a clean install',
  await page.getByText('Welcome to Moove').isVisible().catch(() => false));

const dots = await page.locator('.rounded-full.transition-all').count();
check('the tour is five steps, not six', dots === 5, String(dots));

await page.getByPlaceholder("What's your first name?").fill('Test');
await page.getByRole('button', { name: 'Next' }).click();   // -> personality
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Next' }).click();   // -> today
await page.waitForTimeout(600);

check('the tour reaches a Today step',
  await page.getByText('Start With Today').isVisible().catch(() => false));

const previewIcons = await page.locator('[data-testid="nav-preview"] svg').count();
check('the nav preview shows four icons', previewIcons === 4, String(previewIcons));

const tourText = await page.locator('body').innerText();
check('no Ask Coach step', !/Ask Coach/.test(tourText));
check('the tour does not describe the year grid', !/year grid/i.test(tourText));

await page.getByRole('button', { name: 'Next' }).click();   // -> workout
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Next' }).click();   // -> library
await page.waitForTimeout(400);
check('Library is the last step',
  await page.getByRole('button', { name: "Let's Go" }).isVisible().catch(() => false));
await page.getByRole('button', { name: "Let's Go" }).click();
await page.waitForTimeout(800);
check('finishing the tour lands on Today', await ring().isVisible().catch(() => false));

// ---------------------------------------------------------------- the screen
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('workout_onboarding_complete', 'true');
  localStorage.setItem('workout_personality', 'neutral');
});
await page.reload({ waitUntil: 'networkidle' });
await settle();

check('Today is the landing tab', await ring().isVisible().catch(() => false));
check('Today carries the mark and wordmark',
  (await page.locator('header img[alt="Moove"]').count()) === 2,
  String(await page.locator('header img[alt="Moove"]').count()));
check('the header draws no rule under itself',
  (await page.locator('.mv-rule').count()) === 0,
  String(await page.locator('.mv-rule').count()));
check('the date sits in the Today card, not the header',
  (await page.locator('header').innerText()).trim() === '',
  await page.locator('header').innerText());

// Nothing is held by default, so an untouched day starts empty.
const start = await ring().getAttribute('aria-label').catch(() => null);
check('ring starts at 0 of 4', start === '0 of 4 done today', start ?? '(missing)');

// The week lives on Today now, as seven bars Monday to Sunday.
const strip = page.locator('[aria-label$="percent"]');
check('the week strip shows seven days', (await strip.count()) === 7, String(await strip.count()));
check('the strip is labelled',
  await page.getByText('This week', { exact: true }).isVisible().catch(() => false));

// The ring takes its colour from how much of the day is closed, so a quarter
// done and a day finished cannot look alike.
const arcColor = () => page.locator('svg circle').nth(1).evaluate(el => el.getAttribute('stroke'));
const emptyColor = await arcColor();

check('there is no Next card', !(await page.getByText('Next', { exact: true }).isVisible().catch(() => false)));

await page.getByRole('button', { name: 'Walk', exact: true }).click();
await page.waitForTimeout(500);
const after = await ring().getAttribute('aria-label');
check('logging Walk advances the ring', after === '1 of 4 done today', after ?? '(missing)');
const quarterColor = await arcColor();
check('a quarter of a day is red', quarterColor === '#b91c1c', quarterColor ?? '(missing)');
check('the colour moves with the score', quarterColor !== emptyColor || emptyColor === '#b91c1c');

await page.reload({ waitUntil: 'networkidle' });
await settle();
const persisted = await ring().getAttribute('aria-label');
check('the log survives a reload', persisted === '1 of 4 done today', persisted ?? '(missing)');

// A second daily habit takes it to two of four.
await page.getByRole('button', { name: 'Dry day', exact: true }).click();
await page.waitForTimeout(500);
const two = await ring().getAttribute('aria-label');
check('a second daily habit advances it again', two === '2 of 4 done today', two ?? '(missing)');

// A habit that carries a unit records a reading, so tapping it opens a field
// rather than ticking a box. Nothing is logged until the reading is confirmed.
await page.getByRole('button', { name: /^Weight\b/ }).first().click();
await page.waitForTimeout(400);
check('tapping a measured habit opens a field',
  await page.getByLabel('Weight in lb').isVisible().catch(() => false));
const midEntry = await ring().getAttribute('aria-label');
check('opening the field logs nothing on its own', midEntry === '2 of 4 done today', midEntry ?? '(missing)');

await page.getByLabel('Weight in lb').fill('182.4');
await page.getByRole('button', { name: 'Save Weight' }).click();
await page.waitForTimeout(500);
const weighed = await ring().getAttribute('aria-label');
check('confirming a reading checks the habit off', weighed === '3 of 4 done today', weighed ?? '(missing)');
check('the row reports the reading and nothing else',
  await page.getByText('182.4 lb', { exact: true }).isVisible().catch(() => false));
// body_metrics is the store that syncs and that Health imports write to.
// A second home for the same number would disagree with it inside a day.
check('the reading goes to body metrics, not the habit log',
  await page.evaluate(() => {
    const metrics = localStorage.getItem('body_metrics') ?? '';
    const logs = localStorage.getItem('habit_logs') ?? '';
    return metrics.includes('182.4') && !logs.includes('182.4');
  }));

// A weekly habit joins both halves of the fraction on the day it is done, so
// doing one can only add to the day. Weekly rows carry their count in their
// accessible name, so match on a prefix.
const beforeLift = await ring().getAttribute('aria-label');
await page.getByRole('button', { name: /^Lift\b/ }).first().click();
await page.waitForTimeout(500);
const afterLift = await ring().getAttribute('aria-label');
check('a weekly habit counts toward the day it is done',
  afterLift === '4 of 5 done today', `${beforeLift} -> ${afterLift}`);
check('Lift debt updates on its row', await page.getByText('1 of 3 this week').isVisible().catch(() => false));
// Run is owed once a week. Once it is met the row stops counting at you.
await page.getByRole('button', { name: /^Run\b/ }).first().click();
await page.waitForTimeout(500);
check('a weekly habit that is met says so instead of counting',
  await page.getByText('Done this week').isVisible().catch(() => false));
await page.getByRole('button', { name: /^Run\b/ }).first().click();
await page.waitForTimeout(500);

// Playwright refuses to click an obscured control, so this also proves the
// bottom padding clears the nav's floating Workout button.
await page.getByRole('button', { name: 'Make today a rest day' }).click();
await page.waitForTimeout(500);
check('rest day can be set',
  await page.getByRole('button', { name: 'Resting today' }).isVisible().catch(() => false));
const restRing = await ring().getAttribute('aria-label');
check('a rest day still scores what was done', restRing === '4 of 5 done today', restRing ?? '(missing)');
await page.getByRole('button', { name: 'Resting today' }).click();
await page.waitForTimeout(500);
check('rest day can be cleared',
  await page.getByRole('button', { name: 'Make today a rest day' }).isVisible().catch(() => false));

// Four flat tabs, no more.
const navLabels = await page.locator('nav button').allInnerTexts();
check('the nav is exactly four tabs',
  navLabels.length === 4, navLabels.join(', '));
check('the nav is Today, Library, Insights, Settings',
  navLabels.join(',') === 'Today,Library,Insights,Settings', navLabels.join(', '));

// Nothing that already worked may break.
for (const tab of ['Library', 'Insights', 'Settings']) {
  const before = pageErrors.length;
  await page.getByRole('button', { name: tab, exact: true }).click();
  await page.waitForTimeout(900);
  check(`${tab} tab still opens`, pageErrors.length === before, pageErrors.slice(before).join(' | '));
}

// Insights: every range renders, and history before tracking began is empty.
await page.getByRole('button', { name: 'Insights', exact: true }).click();
await page.waitForTimeout(800);
// The range label is not voiced, so it is the stable thing to assert on.
check('Insights opens on the week',
  await page.getByText(/\d+\u2013\d+ \w+|\d+ \w+ \u2013 \d+ \w+/).first().isVisible().catch(() => false));
const verdict = await page.locator('.mv-serif').first().innerText().catch(() => '');
check('the week carries a verdict', verdict.trim().length > 0, verdict);
for (const range of ['month', 'year']) {
  const before = pageErrors.length;
  await page.getByRole('button', { name: range, exact: true }).click();
  await page.waitForTimeout(700);
  check(`Insights renders the ${range}`, pageErrors.length === before, pageErrors.slice(before).join(' | '));
}

// Workout is reachable without a tab. Library opens on Habits now, so the
// start flow is one tab across.
await page.getByRole('button', { name: 'Library', exact: true }).click();
await page.waitForTimeout(700);
check('Library opens on Habits',
  await page.getByRole('button', { name: 'Add a Habit' }).isVisible().catch(() => false));
await page.getByRole('button', { name: 'Workouts', exact: true }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Start a Workout' }).click();
await page.waitForTimeout(800);
check('Library opens the workout flow',
  await page.getByRole('button', { name: 'Today', exact: true }).isVisible().catch(() => false));

await page.getByRole('button', { name: 'Today', exact: true }).click();
await page.waitForTimeout(600);
check('Today survives a round trip through the other tabs', await ring().isVisible().catch(() => false));

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

await page.screenshot({ path: 'today-screen.png', fullPage: true });
await browser.close();

const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
