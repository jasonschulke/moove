# Moove Technical Debt

First logged 2025-09-15 from a full read of the codebase. Updated the same day
after working through most of it. Status markers are accurate as of the branch
described at the bottom.

---

## Done

### 1. Two sync implementations, one of them orphaned — FIXED

`src/data/sync.ts` and `netlify/functions/sync.ts` pushed a blob of
localStorage keys to Netlify Blobs, keyed on an anonymous device ID with no
auth, superseded by the Supabase path but still shipping and still exposing a
writable endpoint keyed on a guessable header.

Both deleted. `getDeviceId`, the one thing still used, moved to
`src/utils/deviceId.ts`. `@netlify/blobs` dropped.

### 2. Anthropic API key in the browser — FIXED, and worse than logged

The original note said the key was in localStorage and sent from the client.
That was true, and there was also a **live `sk-ant-api03` key hardcoded in
`src/data/storage.ts`**, base64-encoded and string-reversed under a comment
calling it obfuscation, used as a fallback whenever the user had not set their
own. It shipped in the bundle and was recoverable by anyone who opened the
deployed site. **That key must be treated as compromised and revoked.**

Now: `src/lib/claudeClient.ts` is the single place that decides how to reach
the API. The user's own key goes direct from the browser; otherwise the request
goes to `netlify/functions/claude.ts`, which holds `ANTHROPIC_API_KEY`
server-side. There is deliberately no third route. The proxy is opt-in via
`VITE_CLAUDE_PROXY`, default off. See `.env.example`.

### 4. `storage.ts` was a god module — FIXED

Split three ways. `storage.ts` is persistence only (1140 lines down to ~830).
`stats.ts` holds the read-only derived queries. `export.ts` holds JSON and CSV
serialisation. Call sites import from the owning module rather than being
re-exported through storage, so the split is real rather than cosmetic.

`hasWorkoutOnDate` and `hasRealWorkoutOnDate` stayed in storage because the
mutators there call them.

### 5. Hardcoded model ID — FIXED

`src/config.ts` owns `CLAUDE_MODEL` and the two token ceilings, overridable
with `VITE_CLAUDE_MODEL`.

### 6. No tests — FIXED, and they found four bugs

Vitest and jsdom, `npm test`, 38 tests across `storage`, `stats` and
`supabaseSync`. Writing them turned up four real defects, all now fixed and
covered:

1. `longestStreak` was short by one whenever the most recent workout was older
   than yesterday, because the run counter was only seeded inside the
   today-or-yesterday branch.
2. `currentStreak` was reassigned on every contiguous pair anywhere in the
   history, so a five-day run from August reported as the current streak once
   the real one had been broken.
3. `hasLocalData` checked only sessions and saved workouts, so a device whose
   data was custom exercises, equipment or rest days read as empty and
   `performInitialSync` took the download branch, which overwrites exactly
   those keys. It now checks all eleven user-authored keys.
4. `downloadAllData` wrote every preference key whenever a cloud row existed,
   but signup auto-creates that row with empty defaults, so logging in could
   blank preferences that only existed locally. Extracted as
   `applyPreferencesToLocal` and `applyProfileToLocal`, which skip empty values.

Streak maths now counts calendar days with a rounded day difference, so the 23
and 25 hour days either side of a DST change still count as one day apart.

### 9. Type model was straining — FIXED

`ExtendedSession` was declared twice, in `useWorkout` and in `WorkoutPage`, and
described fields persisted to localStorage but absent from the type it
extended. Those fields now live on `WorkoutSession`, both local interfaces are
gone, navigation state is stripped before a session is written to completed
history (it was leaking), and the hook reads localStorage once instead of three
times. The unused `WorkoutState` interface was removed.

### 10. Small stuff — FIXED

`package.json` is now `moove` at `0.1.0` with a description.
`seedDefaultWorkouts` uses a seeded-once flag, so deleting every saved workout
no longer brings the default back on the next load.

### Not in the original list: fabricated workout history — FIXED

Found by running the built app in a browser. On a clean install, before any
interaction, the app created six workout sessions.

`HomePage` injected six hardcoded "Backlog Workout" sessions dated January 2026
on every mount, for every user, counting toward totals, streaks and the
contribution graph. `backfillEffortScores` filled missing effort ratings with
`Math.random()` between 4 and 6, making the Effort Trend chart partly invented.

Both removed; the user-triggered backlog feature is untouched. Note that
removing the code cannot retract records already written to a device that ran
the old build. Those are identifiable in Library → History as "Backlog Workout"
with 0 exercises.

---

## Still open

### 3. Files that are too big to reason about — PARTIALLY DONE

`ExerciseCard` and `EditableDescription` were extracted from `LibraryPage`,
which is a pure relocation because they take props and share no state.

The real split is **not** done and was deliberately left alone.
`LibraryPage.tsx` is still ~1750 lines with roughly 35 `useState` hooks in one
component and four tabs sharing several of them. Separating the tabs means
moving state ownership, and neither `tsc` nor a passing build can tell you
whether that broke the UI. It wants a browser and someone who can click
through editing a workout, swipe-to-delete, favourites and the builder modal.

Remaining offenders: `LibraryPage.tsx` ~1750 lines, `WorkoutPage.tsx` 52 KB,
`WorkoutBuilder.tsx` 51 KB, `HomePage.tsx` 43 KB, `SettingsPage.tsx` 35 KB.

### 7. No router — OPEN, deliberately

Navigation is still a `currentPage` string in `App.tsx`. No deep links, no back
button, page state lost on reload. Only worth doing if those start to matter.
Logged so the decision stays deliberate rather than inherited.

### 8. Apple Health import — OPEN, awaiting a decision

`healthImport.ts` (13 KB) and `HealthImport.tsx` (18 KB) parse Apple Health XML
exports. With the Apple Watch gone there is no source feeding them. Left in
place and unwired rather than deleted, because that is a product call.

If body metrics stay in the app they now need a manual entry path, since import
was the only way data got in.

### New: "this week" is a rolling seven days

`getWorkoutStats` counts the last seven days, not the current calendar week.
Fine as it stands, but the habit model wants Monday-to-Sunday in order to say
"2 of 3 lifts, 4 days left". Changing it is part of building that feature, not
a cleanup.

### New: lint baseline

`npx eslint .` reports 20 errors and 9 warnings, all pre-existing and unchanged
by this work (it was 23 and 9 before; three went away with the sync deletion).
Most are `react-hooks/set-state-in-effect` and `react-refresh/only-export-components`.
They are behavioural changes, so they were left alone.

### New: the repo lives in iCloud

The whole working tree, `.git` included, is offloaded to iCloud. Git cannot
read its own HEAD; every command fails until each object is individually
downloaded. This is why the work described here was done in a scratch clone.
Moving the repo out of the synced folder would fix an entire class of problem.
