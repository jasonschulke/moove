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
      'Nothing logged yet.',
      '{open} to go.',
      'The day is still open.',
      'Nothing down so far.',
    ],
    sarcastic: [
      'A blank slate. How ambitious.',
      '{open} untouched. But who is counting.',
      'Zero so far. Bold strategy.',
      'The day is wide open, and so is the list.',
    ],
    encouraging: [
      'Fresh start! {open} waiting for you.',
      'Nothing done yet, and that is fine. Pick one!',
      'The whole day is ahead of you!',
      '{open} to go and plenty of time!',
    ],
    rude: [
      'Nothing. Great.',
      '{open} left. All of them.',
      'Not a single one. Typical.',
      'Blank. Shocking.',
    ],
    zen: [
      'The day is unwritten.',
      '{open} still to come. Begin anywhere.',
      'Nothing yet, and nothing lost.',
      'An empty page is still a page.',
    ],
    flirty: [
      'All of it still ahead of us.',
      '{open} waiting, and so am I.',
      'Nothing yet. I like the anticipation.',
      'Blank slate. Make it interesting.',
    ],
  },

  dayPartial: {
    neutral: [
      '{open} still open.',
      '{open} left today.',
      'Part done. {open} to go.',
      '{open} remaining.',
    ],
    sarcastic: [
      '{open} left. Momentum is a concept.',
      'Partial credit. {open} to go.',
      'Halfway is a place, I suppose. {open} left.',
      '{open} still open, but who is keeping score.',
    ],
    encouraging: [
      'Great start! {open} to go!',
      'You are moving! {open} left.',
      'Momentum! Just {open} more.',
      '{open} away from a full day!',
    ],
    rude: [
      '{open} left. Finish or do not.',
      'Half a job. {open} to go.',
      '{open} still sitting there.',
      'Started. Did not finish. {open} left.',
    ],
    zen: [
      '{open} still to come.',
      'Begun is begun. {open} to go.',
      'The day is partly made. {open} left.',
      '{open} still ahead, unhurried.',
    ],
    flirty: [
      '{open} more and the day is ours.',
      'Warming up nicely. {open} left.',
      'You are getting somewhere. {open} to go.',
      '{open} between you and a clean day.',
    ],
  },

  dayClosed: {
    neutral: [
      'The day is closed.',
      'All {total} done.',
      'Finished.',
      'Nothing left today.',
    ],
    sarcastic: [
      'All {total}. Look at you.',
      'Closed. Did not see that coming.',
      'Finished. I am genuinely surprised.',
      'A full day. Mark the calendar.',
    ],
    encouraging: [
      'All {total} done! Brilliant day!',
      'Full house! Every single one!',
      'Closed it out! So good!',
      'That is the whole day. Outstanding!',
    ],
    rude: [
      'All {total}. Fine. Good.',
      'Done. Do it again tomorrow.',
      'Closed. Took you long enough.',
      'Complete. I guess that counts.',
    ],
    zen: [
      'The day is whole.',
      'All {total}. Rest now.',
      'Complete. Nothing owed.',
      'The circle closed.',
    ],
    flirty: [
      'All {total}. Look at you go.',
      'Closed. That was fun.',
      'Every one of them. Impressive.',
      'Finished, and with style.',
    ],
  },

  dayRest: {
    neutral: [
      'Resting today.',
      'Rest day.',
      'Nothing owed today.',
      'Off today.',
    ],
    sarcastic: [
      'Resting. Convenient.',
      'A rest day. How restorative.',
      'Off today, by decree.',
      'Rest. You have earned it, probably.',
    ],
    encouraging: [
      'Rest is part of it! Enjoy today.',
      'Recovery matters. Take it!',
      'Resting today, and that is training too.',
      'Good call. Rest well!',
    ],
    rude: [
      'Resting. Sure.',
      'Off today. Your call.',
      'Rest day. Do not make it a week.',
      'Nothing owed. Enjoy it.',
    ],
    zen: [
      'Stillness is also practice.',
      'Rest. The body builds here.',
      'Nothing owed. Be here.',
      'A quiet day, on purpose.',
    ],
    flirty: [
      'A day off together. I approve.',
      'Resting. Save some energy for me.',
      'Nothing owed today. Lucky us.',
      'Rest up. Tomorrow is ours.',
    ],
  },

  // ------------------------------------------------- the suggestion reason
  debtComfortable: {
    neutral: [
      '{owed} left, {daysLeft} day{daysLeftS}.',
      '{owed} to go this week, {daysLeft} day{daysLeftS} to do it.',
      '{owed} owed with {daysLeft} day{daysLeftS} in hand.',
      '{daysLeft} day{daysLeftS} left, {owed} to fit in.',
    ],
    sarcastic: [
      '{owed} left, {daysLeft} day{daysLeftS}. Plenty of time to keep putting it off.',
      '{owed} to go. {daysLeft} day{daysLeftS}, if you insist on waiting.',
      '{owed} owed. The week is long, allegedly.',
      '{daysLeft} day{daysLeftS} for {owed}. Comfortable, for now.',
    ],
    encouraging: [
      '{owed} left and {daysLeft} day{daysLeftS} to do it. Easy!',
      'Just {owed} to go this week. You have room!',
      '{owed} owed, {daysLeft} day{daysLeftS}. Totally doable!',
      'Plenty of week left. {owed} to go!',
    ],
    rude: [
      '{owed} left, {daysLeft} day{daysLeftS}. Get on with it.',
      '{owed} owed. You have time, so no excuses later.',
      '{daysLeft} day{daysLeftS} for {owed}. Do not save it all for Sunday.',
      '{owed} to go. Start now or do not complain later.',
    ],
    zen: [
      '{owed} still to place, {daysLeft} day{daysLeftS} to do it.',
      '{owed} owed. There is room.',
      '{daysLeft} day{daysLeftS}, {owed} to place in them.',
      '{owed} ahead, and time enough.',
    ],
    flirty: [
      '{owed} left, {daysLeft} day{daysLeftS}. No rush, but I am waiting.',
      '{owed} to go. We have all week.',
      '{daysLeft} day{daysLeftS} for {owed}. Take your time.',
      '{owed} owed, and the week is young.',
    ],
  },

  debtTight: {
    neutral: [
      'Every remaining day.',
      '{owed} in {daysLeft} day{daysLeftS}. No slack.',
      'One a day from here.',
      '{owed} left, {daysLeft} day{daysLeftS}. Every one counts.',
    ],
    sarcastic: [
      '{owed} in {daysLeft} day{daysLeftS}. Every single one. Well done.',
      'One a day from here. Enjoy the schedule you built.',
      'No slack left. Funny how that happens.',
      'Every remaining day. Who could have predicted this.',
    ],
    encouraging: [
      'One a day from here. You can absolutely do this!',
      '{owed} in {daysLeft} day{daysLeftS}. Tight, but you have got it!',
      'Every day counts now. Let us go!',
      'No slack left, and no reason to panic. One a day!',
    ],
    rude: [
      'One a day now. Your own fault.',
      '{owed} in {daysLeft} day{daysLeftS}. No room left.',
      'Every remaining day. Should have started earlier.',
      'No slack. Deal with it.',
    ],
    zen: [
      'One each day from here.',
      '{owed} in {daysLeft} day{daysLeftS}. The path is narrow now.',
      'No slack remains. Move steadily.',
      'Every day is needed. Begin.',
    ],
    flirty: [
      'One a day from here. I like the intensity.',
      '{owed} in {daysLeft} day{daysLeftS}. Cutting it close, and I am here for it.',
      'No slack left. Make every one count.',
      'Every remaining day. Keep up.',
    ],
  },

  debtLastDay: {
    neutral: [
      'Last day of the week.',
      'Sunday. Last chance.',
      'The week ends today.',
      'Today or it does not happen.',
    ],
    sarcastic: [
      'Last day. Down to the wire, as usual.',
      'Sunday. This was always going to happen.',
      'The week ends today. No pressure.',
      'Last chance. Classic.',
    ],
    encouraging: [
      'Last day! Finish the week strong!',
      'Sunday. One more and the week is yours!',
      'Final chance. You have got this!',
      'The week ends today. Make it count!',
    ],
    rude: [
      'Last day. Now or never.',
      'Sunday. You left it late again.',
      'Today or the week is a write-off.',
      'Final chance. Do not waste it.',
    ],
    zen: [
      'The week closes today.',
      'Last day. What is done is done after this.',
      'Sunday. The final opportunity.',
      'Today completes it, or it stays undone.',
    ],
    flirty: [
      'Last day. Go on, impress me.',
      'Sunday. Finish what you started.',
      'The week ends tonight. Make it worth it.',
      'Final chance. I am watching.',
    ],
  },

  dailyOpen: {
    neutral: [
      'Still open today.',
      'Not done yet.',
      'Outstanding today.',
      'Waiting on this one.',
    ],
    sarcastic: [
      'Still open. Somehow.',
      'Not done yet. Shocking.',
      'Outstanding, in the boring sense.',
      'This one is still sitting there.',
    ],
    encouraging: [
      'Still open. Quick win right here!',
      'Not done yet. Go get it!',
      'This one is waiting for you!',
      'Easy one to close out!',
    ],
    rude: [
      'Still open. Obviously.',
      'Not done. Do it.',
      'This one is just sitting there.',
      'Outstanding. Deal with it.',
    ],
    zen: [
      'Still open.',
      'This one waits.',
      'Undone, and easily done.',
      'It remains.',
    ],
    flirty: [
      'Still open. Do not leave it hanging.',
      'This one is waiting on you.',
      'Not done yet. Come on.',
      'One little thing left.',
    ],
  },

  allSettled: {
    neutral: [
      'Nothing left.',
      'All clear.',
      'Everything is done.',
      'Nothing owed.',
    ],
    sarcastic: [
      'Nothing left. Truly a historic day.',
      'All clear. Savour it.',
      'Everything done. Who are you.',
      'Nothing owed. Suspicious.',
    ],
    encouraging: [
      'Nothing left! Fantastic!',
      'All clear! You did everything!',
      'Everything done! Enjoy it!',
      'Nothing owed. Go and rest!',
    ],
    rude: [
      'Nothing left. Good.',
      'All clear. Do not get comfortable.',
      'Everything done. Again tomorrow.',
      'Nothing owed. For now.',
    ],
    zen: [
      'Nothing remains.',
      'All is settled.',
      'The list is empty. Be here.',
      'Nothing owed. Rest.',
    ],
    flirty: [
      'Nothing left. Now what shall we do.',
      'All clear. Show off.',
      'Everything done. You are impossible.',
      'Nothing owed. Enjoy yourself.',
    ],
  },

  // ------------------------------------------------------ the week verdict
  weekPerfect: {
    neutral: [
      'Every day closed. Nothing owed.',
      '{counted} for {counted}. Clean week.',
      'Every day closed. Nothing outstanding.',
      'A complete week.',
    ],
    sarcastic: [
      'Every day closed. Frame it.',
      '{counted} for {counted}. Who are you and what happened.',
      'A clean week. Do not let it go to your head.',
      'Every day closed. Suspiciously competent.',
    ],
    encouraging: [
      'Every day closed. What a week!',
      '{counted} for {counted}. You were unstoppable!',
      'Every single day. Incredible!',
      'A perfect week. Be proud of that!',
    ],
    rude: [
      'Every day closed. Fine. Good week.',
      '{counted} for {counted}. Now do it again.',
      'Clean week. Do not coast on it.',
      'Every day closed. About time.',
    ],
    zen: [
      'Every day closed. Nothing owed.',
      'A whole week, unbroken.',
      'Every day met. Rest in that.',
      'The week is complete.',
    ],
    flirty: [
      'Every day closed. Showing off.',
      '{counted} for {counted}. You are trouble.',
      'A perfect week. I noticed.',
      'Every day. Very impressive.',
    ],
  },

  weekGap: {
    neutral: [
      '{closed} of {counted} closed. {habit} is the gap.',
      '{closed} of {counted}. {habit} is behind.',
      '{closed} of {counted} closed. {habit} slipped.',
      '{habit} is the shortfall. {closed} of {counted} closed.',
    ],
    sarcastic: [
      '{closed} of {counted} closed. {habit} continues to elude you.',
      '{closed} of {counted}. {habit} is the usual suspect.',
      '{habit} slipped again. {closed} of {counted} closed.',
      '{closed} of {counted}. Guess which one is short.',
    ],
    encouraging: [
      '{closed} of {counted} closed. {habit} just needs a nudge!',
      '{closed} of {counted}. Nearly there, {habit} is the one to chase!',
      'Strong week! {habit} is the only gap.',
      '{closed} of {counted} closed. Give {habit} some attention!',
    ],
    rude: [
      '{closed} of {counted} closed. {habit} is the problem.',
      '{closed} of {counted}. {habit} again.',
      '{habit} is where it fell apart.',
      '{closed} of {counted} closed. Fix {habit}.',
    ],
    zen: [
      '{closed} of {counted} closed. {habit} asks for more.',
      '{closed} of {counted}. {habit} is where the week thinned.',
      '{habit} fell short. The rest held.',
      '{closed} of {counted} closed. Notice {habit}.',
    ],
    flirty: [
      '{closed} of {counted} closed. {habit} is being neglected.',
      '{closed} of {counted}. {habit} misses you.',
      '{habit} is the one you keep avoiding.',
      '{closed} of {counted} closed. Give {habit} a look.',
    ],
  },

  weekZero: {
    neutral: [
      '{closed} of {counted} closed. No {habitLower} yet.',
      '{closed} of {counted}. {habit} has not happened.',
      'No {habitLower} this week. {closed} of {counted} closed.',
      '{closed} of {counted} closed. {habit} is untouched.',
    ],
    sarcastic: [
      '{closed} of {counted} closed. No {habitLower}. Not even once.',
      'Zero {habitLower} this week. A bold commitment.',
      '{closed} of {counted}. {habit} remains theoretical.',
      'No {habitLower} at all. Impressive consistency.',
    ],
    encouraging: [
      '{closed} of {counted} closed. {habit} is still waiting for you!',
      'No {habitLower} yet, but there is still time!',
      '{closed} of {counted}. Get one {habit} in and the week turns around!',
      '{habit} has not happened yet. Today could fix that!',
    ],
    rude: [
      '{closed} of {counted} closed. No {habitLower}. None.',
      'Zero {habitLower}. That was the easy one.',
      '{closed} of {counted}. {habit} did not happen at all.',
      'No {habitLower} this week. Not once.',
    ],
    zen: [
      '{closed} of {counted} closed. {habit} did not arrive.',
      'No {habitLower} this week. The week is not over.',
      '{closed} of {counted}. {habit} waits still.',
      '{habit} untouched. Notice it without judgement.',
    ],
    flirty: [
      '{closed} of {counted} closed. No {habitLower} at all. Playing hard to get.',
      'Zero {habitLower} this week. I am a little hurt.',
      '{closed} of {counted}. {habit} has been completely ignored.',
      'No {habitLower}. Not once. Cruel.',
    ],
  },

  weekNotStarted: {
    neutral: [
      'The week has not started.',
      'Nothing logged this week yet.',
      'A fresh week.',
      'Week one, day zero.',
    ],
    sarcastic: [
      'The week has not started. Nor has anything else.',
      'Nothing yet. Early days, technically.',
      'A fresh week. Let us see how long that lasts.',
      'Blank week. So far so predictable.',
    ],
    encouraging: [
      'Fresh week! Anything is possible.',
      'The week has not started. Perfect time to begin!',
      'Clean slate. Make it a good one!',
      'Nothing logged yet, and everything ahead!',
    ],
    rude: [
      'The week has not started. Start it.',
      'Nothing yet. Obviously.',
      'Blank week. Do something.',
      'Nothing logged. Go on then.',
    ],
    zen: [
      'The week has not begun.',
      'A fresh week, unmarked.',
      'Nothing yet, and nothing lost.',
      'The week is still ahead.',
    ],
    flirty: [
      'The week has not started. I am ready when you are.',
      'Fresh week. Show me something.',
      'Nothing yet. All to play for.',
      'Clean slate. Make it interesting.',
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
