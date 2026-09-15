/**
 * Tone of voice.
 *
 * The old greeting was keyed on the clock, which meant it could not know
 * anything: "Good morning" says the same thing whether you are three lifts
 * down or finished for the week. These lines are keyed on the situation
 * instead, so the voice carries the nudge rather than decorating the header.
 *
 * Registers follow the copy already in the app - the HomePage greetings and
 * the cow's completion messages - so a personality reads the same here as it
 * always did.
 *
 * Deterministic by design. The old greeting used Math.random(), so the line
 * changed on every render; these are seeded from the date, so a line holds
 * still all day and turns over tomorrow.
 */

import type { PersonalityType } from '../types';
import { loadPersonality, loadUserName, formatLocalDate } from './storage';

export type Situation =
  // The line beside Today's ring.
  | 'dayEmpty' | 'dayPartial' | 'dayClosed' | 'dayRest'
  // The reason under Today's suggestion.
  | 'debtComfortable' | 'debtTight' | 'debtLastDay' | 'dailyOpen'
  // When there is nothing left to suggest.
  | 'allSettled'
  // The verdict at the top of Insights.
  | 'weekPerfect' | 'weekGap' | 'weekZero' | 'weekNotStarted';

export interface VoiceContext {
  /** Daily habits still open today. */
  open?: number;
  /** Daily habits due today. */
  total?: number;
  /** Times a weekly habit is still owed. */
  owed?: number;
  /** Days from today through Sunday, inclusive. */
  daysLeft?: number;
  /** The habit under discussion. */
  habit?: string;
  /** Days of the week that closed completely. */
  closed?: number;
  /** Days of the week that have happened. */
  counted?: number;
}

type Lines = Record<PersonalityType, string[]>;

const VOICE: Record<Situation, Lines> = {
  // ---------------------------------------------------------- the day ring
  dayEmpty: {
    neutral: [
      "Nothing yet.",
      "{open} to go.",
      "Haven't started.",
      "All {open} still open.",
    ],
    sarcastic: [
      "Nothing yet. Ambitious.",
      "{open} untouched. Impressive.",
      "Still on zero.",
      "Not one. Bold.",
    ],
    encouraging: [
      "Fresh start. {open} to go!",
      "Nothing yet, and that's fine. Pick one.",
      "Whole day ahead of you!",
      "{open} to go and loads of time.",
    ],
    rude: [
      "Nothing. Great.",
      "{open} left. All of them.",
      "Zero. Well done.",
      "Haven't started. Obviously.",
    ],
    zen: [
      "Nothing yet. No rush.",
      "{open} to go. Start with one.",
      "Haven't begun. That's fine.",
      "All {open} still ahead.",
    ],
    flirty: [
      "Nothing yet. All to play for.",
      "{open} waiting on you.",
      "Haven't started? I'll wait.",
      "Blank slate. Go on.",
    ],
  },

  dayPartial: {
    neutral: [
      "{open} still open.",
      "{open} to go.",
      "{open} left.",
      "Nearly. {open} to go.",
    ],
    sarcastic: [
      "{open} left. Momentum, sort of.",
      "{open} to go. Don't stop now.",
      "Partial credit. {open} left.",
      "{open} still open. Classic.",
    ],
    encouraging: [
      "Good start! {open} to go.",
      "You're moving. {open} left!",
      "Nice. Just {open} more.",
      "{open} off a full day!",
    ],
    rude: [
      "{open} left. Finish it.",
      "Half a job. {open} to go.",
      "{open} still sitting there.",
      "Started, didn't finish. {open} left.",
    ],
    zen: [
      "{open} to go. Easy does it.",
      "You've started. {open} left.",
      "{open} still open. No rush.",
      "Good. {open} more.",
    ],
    flirty: [
      "{open} more and we're done.",
      "Warming up. {open} left.",
      "{open} to go. Keep going.",
      "{open} between you and a clean day.",
    ],
  },

  dayClosed: {
    neutral: [
      "Day's done.",
      "All {total}.",
      "Finished.",
      "Nothing left today.",
    ],
    sarcastic: [
      "All {total}. Look at you.",
      "Done. Didn't see that coming.",
      "Finished. I'm genuinely surprised.",
      "A full day. Someone mark it.",
    ],
    encouraging: [
      "All {total}! Brilliant day.",
      "Full house. Every one!",
      "Closed it out. Love that.",
      "That's the lot. Well done!",
    ],
    rude: [
      "All {total}. Fine. Good.",
      "Done. Again tomorrow.",
      "Finished. Took you long enough.",
      "Clean day. Don't coast.",
    ],
    zen: [
      "Day's done. Rest.",
      "All {total}. Nothing owed.",
      "Finished. Let it go.",
      "That's the day.",
    ],
    flirty: [
      "All {total}. Showing off.",
      "Done, and with style.",
      "Every one. Impressive.",
      "Finished. That was fun.",
    ],
  },

  dayRest: {
    neutral: [
      "Rest day.",
      "Resting today.",
      "Nothing owed.",
      "Off today.",
    ],
    sarcastic: [
      "Resting. Convenient.",
      "A rest day. How restorative.",
      "Off today, by royal decree.",
      "Rest. You've earned it, probably.",
    ],
    encouraging: [
      "Rest is part of it. Enjoy it!",
      "Recovery counts. Take it.",
      "Resting today, and that's training too.",
      "Good call. Rest well!",
    ],
    rude: [
      "Resting. Sure.",
      "Off today. Your call.",
      "Rest day. Don't make it a week.",
      "Nothing owed. Enjoy.",
    ],
    zen: [
      "Rest day. Take it.",
      "Nothing owed today.",
      "Off today. That's the plan.",
      "Resting. It'll keep.",
    ],
    flirty: [
      "A day off together. I approve.",
      "Resting. Save some for me.",
      "Nothing owed. Lucky us.",
      "Rest up. Tomorrow's ours.",
    ],
  },

  // ------------------------------------------------- the suggestion reason
  debtComfortable: {
    neutral: [
      "{owed} left, {daysLeft} day{daysLeftS}.",
      "{owed} to go this week.",
      "{owed} owed, {daysLeft} day{daysLeftS} to do it.",
      "{daysLeft} day{daysLeftS} left for {owed}.",
    ],
    sarcastic: [
      "{owed} left, {daysLeft} day{daysLeftS}. Loads of time to keep avoiding it.",
      "{owed} to go. No rush, obviously.",
      "{owed} owed. The week's long, allegedly.",
      "{daysLeft} day{daysLeftS} for {owed}. Comfortable. For now.",
    ],
    encouraging: [
      "{owed} left and {daysLeft} day{daysLeftS}. Easy!",
      "Just {owed} this week. You've got room.",
      "{owed} owed, {daysLeft} day{daysLeftS}. Very doable!",
      "Plenty of week left. {owed} to go.",
    ],
    rude: [
      "{owed} left, {daysLeft} day{daysLeftS}. Get on with it.",
      "{owed} owed. You've got time, so no excuses later.",
      "{daysLeft} day{daysLeftS} for {owed}. Don't save it all for Sunday.",
      "{owed} to go. Start now.",
    ],
    zen: [
      "{owed} left, {daysLeft} day{daysLeftS}. No rush.",
      "{owed} to go. There's room.",
      "{daysLeft} day{daysLeftS} for {owed}. Take one.",
      "{owed} to go. There's time.",
    ],
    flirty: [
      "{owed} left, {daysLeft} day{daysLeftS}. I'm patient.",
      "{owed} to go. We've got all week.",
      "{daysLeft} day{daysLeftS} for {owed}. Take your time.",
      "{owed} owed, and the week's young.",
    ],
  },

  debtTight: {
    neutral: [
      "One a day from here.",
      "{owed} in {daysLeft} day{daysLeftS}. No slack.",
      "Every day counts now.",
      "{owed} left, {daysLeft} day{daysLeftS}.",
    ],
    sarcastic: [
      "{owed} in {daysLeft} day{daysLeftS}. Every single one. Nice planning.",
      "One a day from here. Enjoy the schedule you built.",
      "No slack left. Funny, that.",
      "Every remaining day. Who'd have guessed.",
    ],
    encouraging: [
      "One a day from here. You can do this!",
      "{owed} in {daysLeft} day{daysLeftS}. Tight, but you've got it.",
      "Every day counts now. Let's go!",
      "No slack left, and no need to panic.",
    ],
    rude: [
      "One a day now. Your own fault.",
      "{owed} in {daysLeft} day{daysLeftS}. No room.",
      "Every day now. Should've started earlier.",
      "No slack. Deal with it.",
    ],
    zen: [
      "One each day from here.",
      "{owed} in {daysLeft} day{daysLeftS}. Tight. Start today.",
      "No slack left. Steady.",
      "One a day, every day left.",
    ],
    flirty: [
      "One a day from here. I like the pressure.",
      "{owed} in {daysLeft} day{daysLeftS}. Cutting it fine.",
      "No slack left. Keep up.",
      "Every day now. Don't let me down.",
    ],
  },

  debtLastDay: {
    neutral: [
      "Last day of the week.",
      "Sunday. Last chance.",
      "Week ends today.",
      "Today or it doesn't happen.",
    ],
    sarcastic: [
      "Last day. Down to the wire, as ever.",
      "Sunday. Saw this coming.",
      "Week ends today. No pressure.",
      "Last chance. Classic.",
    ],
    encouraging: [
      "Last day. Finish strong!",
      "Sunday. One more and the week's yours.",
      "Final chance. You've got this!",
      "Week ends today. Make it count.",
    ],
    rude: [
      "Last day. Now or never.",
      "Sunday. You left it late again.",
      "Today or the week's a write-off.",
      "Final chance. Don't waste it.",
    ],
    zen: [
      "Week ends today. Last go.",
      "Last day. After this it's done either way.",
      "Sunday. Now, or it waits a week.",
      "Today finishes it, or it stays undone.",
    ],
    flirty: [
      "Last day. Go on, impress me.",
      "Sunday. Finish what you started.",
      "Week ends tonight. Worth it?",
      "Final chance. No pressure.",
    ],
  },

  dailyOpen: {
    neutral: [
      "Still open.",
      "Not done yet.",
      "Still on the list.",
      "This one's waiting.",
    ],
    sarcastic: [
      "Still open. Somehow.",
      "Not done yet. Shocking.",
      "This one's just sitting there.",
      "Still not done. Riveting.",
    ],
    encouraging: [
      "Still open. Quick win!",
      "Not done yet. Go get it.",
      "This one's waiting for you!",
      "Easy one to close out.",
    ],
    rude: [
      "Still open. Obviously.",
      "Not done. Do it.",
      "Been there all day.",
      "Still open. Sort it.",
    ],
    zen: [
      "Still open. Whenever you like.",
      "No hurry on this one.",
      "Not done yet. Easy enough.",
      "Still there.",
    ],
    flirty: [
      "Still open. Don't leave it hanging.",
      "This one's waiting on you.",
      "Not done yet. Come on.",
      "One little thing left.",
    ],
  },

  allSettled: {
    neutral: [
      "Nothing left.",
      "All clear.",
      "Everything's done.",
      "Nothing owed.",
    ],
    sarcastic: [
      "Nothing left. Historic.",
      "All clear. Savour it.",
      "Everything done. Who are you.",
      "Nothing owed. Suspicious.",
    ],
    encouraging: [
      "Nothing left. Fantastic!",
      "All clear. You did the lot!",
      "Everything's done. Enjoy it.",
      "Nothing owed. Go rest!",
    ],
    rude: [
      "Nothing left. Good.",
      "All clear. Don't get comfortable.",
      "Everything's done. Again tomorrow.",
      "Nothing owed. For now.",
    ],
    zen: [
      "Nothing left to chase.",
      "All clear. Rest.",
      "Everything's done. Good day.",
      "Nothing owed. Enjoy the evening.",
    ],
    flirty: [
      "Nothing left. Now what?",
      "All clear. Show off.",
      "Everything's done. You're impossible.",
      "Nothing owed. Enjoy yourself.",
    ],
  },

  // ------------------------------------------------------ the week verdict
  weekPerfect: {
    neutral: [
      "Every day closed. Nothing owed.",
      "{counted} for {counted}. Clean week.",
      "Whole week done.",
      "Nothing missed.",
    ],
    sarcastic: [
      "Every day closed. Frame it.",
      "{counted} for {counted}. Who are you and what happened.",
      "Clean week. Don't let it go to your head.",
      "Nothing missed. Suspiciously competent.",
    ],
    encouraging: [
      "Every day closed. What a week!",
      "{counted} for {counted}. Unstoppable.",
      "Every single day. Incredible!",
      "Perfect week. Be proud of that.",
    ],
    rude: [
      "Every day closed. Fine. Good week.",
      "{counted} for {counted}. Now do it again.",
      "Clean week. Don't coast.",
      "Nothing missed. About time.",
    ],
    zen: [
      "Every day closed. Nothing to carry.",
      "Whole week, nothing missed.",
      "{counted} for {counted}. Take the win.",
      "Clean week.",
    ],
    flirty: [
      "Every day closed. Showing off.",
      "{counted} for {counted}. You're trouble.",
      "Perfect week. I noticed.",
      "Every day. Very impressive.",
    ],
  },

  weekGap: {
    neutral: [
      "{closed} of {counted} closed. {habit} is behind.",
      "{closed} of {counted}. {habit} slipped.",
      "{habit} is short this week.",
      "{closed} of {counted} closed. {habitLower} needs a look.",
    ],
    sarcastic: [
      "{closed} of {counted} closed. {habit} keeps getting away from you.",
      "{closed} of {counted}. {habit}, again.",
      "{habit} slipped. Shocking.",
      "{closed} of {counted} closed. Guess which one's short.",
    ],
    encouraging: [
      "{closed} of {counted} closed. {habit} just needs a nudge.",
      "{closed} of {counted}. Nearly there. {habit} is the one to chase!",
      "Strong week. {habit} is the only gap.",
      "{closed} of {counted} closed. Give {habitLower} some love.",
    ],
    rude: [
      "{closed} of {counted} closed. {habit} is the problem.",
      "{closed} of {counted}. {habit} again.",
      "{habit} is where it fell over.",
      "{closed} of {counted} closed. Sort {habitLower} out.",
    ],
    zen: [
      "{closed} of {counted} closed. {habit} came up short.",
      "{closed} of {counted}. {habit} is the one that slipped.",
      "{habit} slipped. The rest was fine.",
      "{closed} of {counted} closed. Watch {habitLower}.",
    ],
    flirty: [
      "{closed} of {counted} closed. {habit} is being neglected.",
      "{closed} of {counted}. {habit} misses you.",
      "{habit} is the one you keep dodging.",
      "{closed} of {counted} closed. Give {habitLower} a look.",
    ],
  },

  weekZero: {
    neutral: [
      "{closed} of {counted} closed. No {habitLower} yet.",
      "{closed} of {counted}. Haven't done {habitLower}.",
      "No {habitLower} this week.",
      "{closed} of {counted} closed. {habit} is untouched.",
    ],
    sarcastic: [
      "{closed} of {counted} closed. No {habitLower}. Not once.",
      "Zero {habitLower} this week. Committed.",
      "{closed} of {counted}. {habit} remains theoretical.",
      "No {habitLower} at all. Consistent, at least.",
    ],
    encouraging: [
      "{closed} of {counted} closed. {habit} is still waiting for you.",
      "No {habitLower} yet, but there's time!",
      "{closed} of {counted}. One {habitLower} and the week turns around.",
      "{habit} hasn't happened yet. Today could fix that!",
    ],
    rude: [
      "{closed} of {counted} closed. No {habitLower}. None.",
      "Zero {habitLower}. That was the easy one.",
      "{closed} of {counted}. {habit} didn't happen at all.",
      "No {habitLower} this week. Not once.",
    ],
    zen: [
      "{closed} of {counted} closed. No {habitLower} yet. There's time.",
      "Haven't done {habitLower} this week. Week's not over.",
      "{closed} of {counted}. {habit} is still waiting.",
      "No {habitLower} yet. Still time.",
    ],
    flirty: [
      "{closed} of {counted} closed. No {habitLower} at all. Playing hard to get.",
      "Zero {habitLower} this week. I'm a bit hurt.",
      "{closed} of {counted}. {habit} has been completely ignored.",
      "No {habitLower}. Not once. Harsh.",
    ],
  },

  weekNotStarted: {
    neutral: [
      "Week's just started.",
      "Nothing logged yet.",
      "Fresh week.",
      "Nothing down so far.",
    ],
    sarcastic: [
      "Week's just started. So has nothing else.",
      "Nothing yet. Early days, technically.",
      "Fresh week. Let's see how long that lasts.",
      "Blank week. Predictable.",
    ],
    encouraging: [
      "Fresh week. Anything's possible!",
      "Week's just started. Perfect time to begin.",
      "Clean slate. Make it a good one!",
      "Nothing logged yet. Whole week ahead.",
    ],
    rude: [
      "Week's just started. Start it, then.",
      "Nothing yet. Obviously.",
      "Blank week. Do something.",
      "Nothing logged. Go on.",
    ],
    zen: [
      "Week's just started. No hurry.",
      "Fresh week. Nothing lost.",
      "Nothing yet. Plenty of time.",
      "Clean slate.",
    ],
    flirty: [
      "Week's just started. Ready when you are.",
      "Fresh week. Show me something.",
      "Nothing yet. Everything ahead.",
      "Clean slate. Make it interesting.",
    ],
  },
};

/**
 * A stable index from a string. The old greeting used Math.random(), so the
 * line changed on every render; seeding from the date and the situation keeps
 * a line still all day and turns it over tomorrow.
 */
function pick(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % count;
}

/**
 * Expands the context with the forms templates need for agreement, so a line
 * can read "1 is still to come" and "2 are still to come" without a separate
 * variant for each. For every number `n`, `nIs` and `nS` come along; `habit`
 * also arrives lowercased, for lines that say "no run yet".
 */
function expand(ctx: VoiceContext): Record<string, unknown> {
  const out: Record<string, unknown> = { ...ctx };
  for (const [key, value] of Object.entries(ctx)) {
    if (typeof value === 'number') {
      out[`${key}Is`] = value === 1 ? 'is' : 'are';
      out[`${key}S`] = value === 1 ? '' : 's';
    }
  }
  if (typeof ctx.habit === 'string') out.habitLower = ctx.habit.toLowerCase();
  return out;
}

function fill(template: string, ctx: VoiceContext): string {
  const values = expand(ctx);
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? whole : String(value);
  });
}

/**
 * The line for a situation, in the user's chosen voice.
 *
 * `on` is the day the line belongs to, which is what makes it stable; pass a
 * date string to pin it in tests. `personality` defaults to the stored choice.
 */
export function say(
  situation: Situation,
  ctx: VoiceContext = {},
  personality: PersonalityType = loadPersonality(),
  on: string = formatLocalDate(new Date()),
): string {
  const lines = VOICE[situation][personality] ?? VOICE[situation].neutral;
  const seed = `${on}|${situation}|${ctx.habit ?? ''}`;
  return fill(lines[pick(seed, lines.length)], ctx);
}

/** Every situation the voice covers. Exported so tests can walk them all. */
export const SITUATIONS = Object.keys(VOICE) as Situation[];

/** The user's name, for the few lines that use it. */
export function voiceName(): string {
  return loadUserName() || 'there';
}
