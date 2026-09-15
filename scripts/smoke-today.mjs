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
});
await page.reload({ waitUntil: 'networkidle' });
await settle();

check('Today is the landing tab', await ring().isVisible().catch(() => false));
check('Today carries the mark and wordmark',
  (await page.locator('header img[alt="Moove"]').count()) === 2,
  String(await page.locator('header img[alt="Moove"]').count()));

// The held dry day means an untouched day starts at 1 of 3.
const start = await ring().getAttribute('aria-label').catch(() => null);
check('ring starts at 1 of 3', start === '1 of 3 done today', start ?? '(missing)');

check('the suggestion carries a reason line',
  await page.getByText(/left, \d days|Every remaining day|Last day of the week/).first()
    .isVisible().catch(() => false));

await page.getByRole('button', { name: 'Walk', exact: true }).click();
await page.waitForTimeout(500);
const after = await ring().getAttribute('aria-label');
check('logging Walk advances the ring', after === '2 of 3 done today', after ?? '(missing)');

await page.reload({ waitUntil: 'networkidle' });
await settle();
const persisted = await ring().getAttribute('aria-label');
check('the log survives a reload', persisted === '2 of 3 done today', persisted ?? '(missing)');

// Breaking the held dry day takes the score back down.
await page.getByRole('button', { name: 'Dry day', exact: true }).click();
await page.waitForTimeout(500);
const broken = await ring().getAttribute('aria-label');
check('breaking the dry day lowers the ring', broken === '1 of 3 done today', broken ?? '(missing)');

// A weekly habit is debt, not day score. Its row carries its own count.
// Weekly rows include that count in their accessible name, so match on a prefix.
const beforeLift = await ring().getAttribute('aria-label');
await page.getByRole('button', { name: /^Lift\b/ }).first().click();
await page.waitForTimeout(500);
const afterLift = await ring().getAttribute('aria-label');
check('logging Lift leaves the ring alone', afterLift === beforeLift, `${beforeLift} -> ${afterLift}`);
check('Lift debt updates on its row', await page.getByText('1 of 3 this week').isVisible().catch(() => false));

// Playwright refuses to click an obscured control, so this also proves the
// bottom padding clears the nav's floating Workout button.
await page.getByRole('button', { name: 'Make today a rest day' }).click();
await page.waitForTimeout(500);
check('rest day can be set', await page.getByText('Nothing owed.').isVisible().catch(() => false));
check('the suggestion goes quiet on a rest day',
  !(await page.getByText(/left, \d days|Every remaining day/).first().isVisible().catch(() => false)));
const restRing = await ring().getAttribute('aria-label');
check('a rest day still scores the daily habits', restRing === '1 of 3 done today', restRing ?? '(missing)');
await page.getByRole('button', { name: 'Resting today' }).click();
await page.waitForTimeout(500);
check('rest day can be cleared', await page.getByText('Next').first().isVisible().catch(() => false));

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
check('Insights opens on the week', await page.getByText(/closed\.|has not started/).first().isVisible().catch(() => false));
for (const range of ['month', 'year']) {
  const before = pageErrors.length;
  await page.getByRole('button', { name: range, exact: true }).click();
  await page.waitForTimeout(700);
  check(`Insights renders the ${range}`, pageErrors.length === before, pageErrors.slice(before).join(' | '));
}

// Workout is reachable without a tab.
await page.getByRole('button', { name: 'Library', exact: true }).click();
await page.waitForTimeout(700);
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
