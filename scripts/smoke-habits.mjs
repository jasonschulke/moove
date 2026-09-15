/**
 * Checks habit management in Library, and that the rest of the app follows it.
 *
 *   npm run build
 *   npx vite preview --port 4173 &
 *   node scripts/smoke-habits.mjs
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
const names = () => page.locator('.mv-card .text-\\[15px\\]').allInnerTexts();
const openLibrary = async () => {
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.waitForTimeout(800);
};
const openToday = async () => {
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.waitForTimeout(800);
};

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('workout_onboarding_complete', 'true');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2600);

await openLibrary();
check('Library lands on Habits', await page.getByRole('button', { name: 'Add a Habit' }).isVisible().catch(() => false));
check('the seeded five are listed',
  (await names()).join(',') === 'Walk,Walk the dog,Dry day,Lift,Run', (await names()).join(','));
check('the dry day reads as a weekly allowance, not as held',
  await page.getByText('5 of 7 days', { exact: true }).isVisible().catch(() => false));
check('a weekly habit reads as weekly', await page.getByText('3× a week').isVisible().catch(() => false));

// Icons. The font is remote, so these assert the ligature reaches the DOM
// rather than how it looks; the glyph itself needs a human eye.
const iconNames = () =>
  page.locator('.mv-card .material-symbols-outlined').evaluateAll(
    els => els.map(el => el.dataset.icon ?? ''));
const seededIcons = await iconNames();
check('every seeded habit shows an icon', seededIcons.length >= 5, seededIcons.join(','));
check('the icons are the seeded ones',
  ['directions_walk', 'pets', 'no_drinks', 'fitness_center', 'directions_run']
    .every(i => seededIcons.includes(i)),
  seededIcons.join(','));

// Adding a daily habit must widen the ring: that is the whole point of scoring
// a day as one number rather than baking three habits into the shape.
await page.getByRole('button', { name: 'Add a Habit' }).click();
await page.waitForTimeout(400);
await page.getByLabel('Habit name').fill('Stretch');
await page.getByRole('button', { name: 'self improvement' }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Add habit' }).click();
await page.waitForTimeout(500);
check('the new habit appears', (await names()).includes('Stretch'), (await names()).join(','));

await openToday();
const widened = await ring().getAttribute('aria-label');
check('the ring widens to 4', widened === '0 of 4 done today', widened ?? '(missing)');
check('the new habit is loggable on Today',
  await page.getByRole('button', { name: 'Stretch', exact: true }).isVisible().catch(() => false));
const todayIcons = await iconNames();
check('the chosen icon follows it to Today',
  todayIcons.includes('self_improvement'), todayIcons.join(','));

// Index-based targeting is a trap once rows move, so everything below
// addresses habits by name.
await openLibrary();
const before = await names();
await page.getByRole('button', { name: 'Move Stretch up' }).click();
await page.waitForTimeout(400);
const after = await names();
check('reorder moves the row one place',
  before.indexOf('Stretch') - after.indexOf('Stretch') === 1,
  `${before.join(',')} -> ${after.join(',')}`);

const card = page.locator('.mv-card').filter({ hasText: 'Stretch' }).first();
await card.getByRole('button', { name: 'Edit' }).click();
await page.waitForTimeout(400);
await page.getByLabel('Habit name').fill('Stretching');
await page.getByRole('button', { name: 'Save' }).click();
await page.waitForTimeout(500);
check('an edit sticks', (await names()).includes('Stretching'), (await names()).join(','));
check('the edit leaves its neighbours alone',
  (await page.getByText('Lift', { exact: true }).count()) === 1);

// Two buttons read "Delete": the one that asks and the one that does. They are
// named apart so the second is never mistaken for the first.
await page.getByRole('button', { name: 'Remove Stretching' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Delete Stretching' }).click();
await page.waitForTimeout(500);
check('delete removes it', !(await names()).includes('Stretching'), (await names()).join(','));

await openToday();
const narrowed = await ring().getAttribute('aria-label');
check('the ring narrows back to 3', narrowed === '0 of 3 done today', narrowed ?? '(missing)');

// An icon font renders its ligature as plain words until the glyph arrives.
// On a phone with no signal that is what the row says, so the glyph is held
// back until the font reports itself loaded.
const leaking = await page.locator('.material-symbols-outlined').evaluateAll(
  els => els
    .filter(el => getComputedStyle(el).visibility !== 'hidden')
    .filter(el => el.getBoundingClientRect().width > el.getBoundingClientRect().height * 2)
    .map(el => el.textContent.trim()));
check('no icon leaks its name as words when the font is unavailable',
  leaking.length === 0, leaking.join(', '));

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
