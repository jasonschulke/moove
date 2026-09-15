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
check('the seeded six are listed, dailies above weeklies',
  (await names()).join(',') === 'Walk,Walk the dog,Dry day,Weight,Lift,Run', (await names()).join(','));
check('the dry day reads as a weekly allowance, not as held',
  await page.getByText('5 of 7 days', { exact: true }).isVisible().catch(() => false));
check('a weekly habit reads as weekly', await page.getByText('3× a week').isVisible().catch(() => false));
check('the list is grouped by cadence',
  (await page.getByText('Daily', { exact: true }).isVisible().catch(() => false)) &&
  (await page.getByText('Weekly', { exact: true }).isVisible().catch(() => false)));

// Icons. The font is remote, so these assert the ligature reaches the DOM
// rather than how it looks; the glyph itself needs a human eye.
const iconNames = () =>
  page.locator('.mv-card .material-symbols-outlined').evaluateAll(
    els => els.map(el => el.dataset.icon ?? ''));
const seededIcons = await iconNames();
check('every seeded habit shows an icon', seededIcons.length >= 6, seededIcons.join(','));
check('the icons are the seeded ones',
  ['directions_walk', 'pets', 'no_drinks', 'fitness_center', 'directions_run', 'monitor_weight']
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
check('the ring widens to 5', widened === '0 of 5 done today', widened ?? '(missing)');
check('the new habit is loggable on Today',
  await page.getByRole('button', { name: 'Stretch', exact: true }).isVisible().catch(() => false));
const todayIcons = await iconNames();
check('the chosen icon follows it to Today',
  todayIcons.includes('self_improvement'), todayIcons.join(','));

// Index-based targeting is a trap once rows move, so everything below
// addresses habits by name.
await openLibrary();
check('the arrows stay hidden until you ask to reorder',
  (await page.getByRole('button', { name: 'Move Stretch up' }).count()) === 0);
check('no gear sits on the habit cards',
  (await page.getByRole('button', { name: /^Options for / }).count()) === 0);
await page.getByRole('button', { name: 'Habit list options' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Reorder habits' }).click();
await page.waitForTimeout(400);
const before = await names();
await page.getByRole('button', { name: 'Move Stretch up' }).click();
await page.waitForTimeout(400);
const after = await names();
check('reorder moves the row one place',
  before.indexOf('Stretch') - after.indexOf('Stretch') === 1,
  `${before.join(',')} -> ${after.join(',')}`);
await page.getByRole('button', { name: 'Finish reordering' }).first().click();
await page.waitForTimeout(400);

// The card itself is the edit control, and it opens in place rather than as a
// second card above the list.
await page.getByRole('button', { name: 'Edit Stretch', exact: true }).click();
await page.waitForTimeout(400);
check('editing does not leave a duplicate card behind',
  (await names()).filter(n => n === 'Stretch').length === 0,
  (await names()).join(','));
await page.getByLabel('Habit name').fill('Stretching');
await page.getByRole('button', { name: 'Save' }).click();
await page.waitForTimeout(500);
check('an edit sticks', (await names()).includes('Stretching'), (await names()).join(','));
check('the edit leaves its neighbours alone',
  (await page.getByText('Lift', { exact: true }).count()) === 1);

// Two buttons read "Delete": the one that asks and the one that does. They are
// named apart so the second is never mistaken for the first.
// Delete lives inside the editor now, not beside the habit.
await page.getByRole('button', { name: 'Edit Stretching', exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Remove Stretching' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Delete Stretching' }).click();
await page.waitForTimeout(500);
check('delete removes it', !(await names()).includes('Stretching'), (await names()).join(','));

await openToday();
const narrowed = await ring().getAttribute('aria-label');
check('the ring narrows back to 4', narrowed === '0 of 4 done today', narrowed ?? '(missing)');

// A habit can record a number rather than a tick, with a target that decides
// whether the day counts. This is the whole path: build one in Library, log a
// short reading on Today, then a good one.
await openLibrary();
await page.getByRole('button', { name: 'Add a Habit' }).click();
await page.waitForTimeout(400);
await page.getByLabel('Habit name').fill('Water');
await page.getByRole('button', { name: 'Record a number' }).click();
await page.waitForTimeout(300);
check('the unit field appears once the habit records a number',
  await page.getByLabel('Unit', { exact: true }).isVisible().catch(() => false));
await page.getByRole('button', { name: 'Unit oz' }).click();
await page.getByLabel('Goal').fill('64');
await page.waitForTimeout(300);
check('a goal offers a direction',
  await page.getByRole('button', { name: 'At most' }).isVisible().catch(() => false));
check('a measured habit drops the held option',
  !(await page.getByText('Held unless I break it').isVisible().catch(() => false)));
await page.getByRole('button', { name: 'Add habit' }).click();
await page.waitForTimeout(600);
check('the list shows the goal and nothing about recording',
  (await page.getByText('Goal ≥ 64 oz').isVisible().catch(() => false)) &&
  (await page.getByText(/Records/).count()) === 0);

await openToday();
check('an unlogged row says nothing about the goal',
  (await page.getByText(/Goal .*oz/).count()) === 0);
await page.getByRole('button', { name: /^Water\b/ }).first().click();
await page.waitForTimeout(400);
await page.getByLabel('Water in oz').fill('48');
await page.getByRole('button', { name: 'Save Water' }).click();
await page.waitForTimeout(500);
check('the row shows the reading, not a fraction of the goal',
  await page.getByText('48 oz', { exact: true }).isVisible().catch(() => false));
// Taking the reading is the task. A goal months out must not hold the day open.
const short = await ring().getAttribute('aria-label');
check('a reading short of the goal still closes the habit',
  short === '1 of 5 done today', short ?? '(missing)');

await page.getByRole('button', { name: 'Insights', exact: true }).click();
await page.waitForTimeout(900);
check('a measured habit gets its own chart on Insights',
  await page.getByText('Goal ≥ 64 oz').first().isVisible().catch(() => false));
// A day you missed is the one you most want to fix. These habits all started
// today, so 14 September is a day nothing was being tracked on: the sheet has
// to offer them anyway, and ticking one has to pull its start back.
await page.getByRole('button', { name: 'month', exact: true }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /^2026-09-14/ }).click();
await page.waitForTimeout(600);
check('a day before anything was tracked still offers the habits',
  await page.getByRole('button', { name: /^Walk\b/ }).first().isVisible().catch(() => false));
await page.getByRole('button', { name: /^Walk\b/ }).first().click();
await page.waitForTimeout(600);
check('filling in a past day sticks',
  await page.evaluate(() => JSON.parse(localStorage.getItem('habit_logs') ?? '{}')['2026-09-14'] !== undefined));
check('filling in a past day pulls the habit start back to it',
  await page.evaluate(() => JSON.parse(localStorage.getItem('habit_definitions'))
    .find(h => h.name === 'Walk').createdOn === '2026-09-14'));
await page.getByRole('button', { name: 'Done', exact: true }).click();
await page.waitForTimeout(500);
check('weight still gets a card of its own',
  await page.getByText('Tap Weight on Today to log one').isVisible().catch(() => false));
await openToday();

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
