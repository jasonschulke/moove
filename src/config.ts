/**
 * App-wide configuration constants.
 *
 * Values that were previously hardcoded at their point of use and drifted
 * out of date without anyone noticing.
 */

/**
 * The Anthropic model the AI coach talks to.
 * Override per-environment with VITE_CLAUDE_MODEL.
 *
 * A retired model id is a 404 on /v1/messages, which reads as a bad key and
 * is not: claude-sonnet-4-20250514 was pinned here and went away underneath
 * the app. Pinning a dated snapshot buys reproducibility that a habit tracker
 * does not need and costs an outage nobody is watching for, so this tracks the
 * moving Sonnet alias instead.
 */
export const CLAUDE_MODEL: string =
  import.meta.env.VITE_CLAUDE_MODEL ?? 'claude-sonnet-5';

/** Token ceiling for a full coach reply. */
export const CLAUDE_MAX_TOKENS_CHAT = 1024;

/** Token ceiling for the short follow-up suggestion call. */
export const CLAUDE_MAX_TOKENS_SUGGESTIONS = 200;
