/**
 * App-wide configuration constants.
 *
 * Values that were previously hardcoded at their point of use and drifted
 * out of date without anyone noticing.
 */

/**
 * The Anthropic model the AI coach talks to.
 * Override per-environment with VITE_CLAUDE_MODEL.
 */
export const CLAUDE_MODEL: string =
  import.meta.env.VITE_CLAUDE_MODEL ?? 'claude-sonnet-4-20250514';

/** Token ceiling for a full coach reply. */
export const CLAUDE_MAX_TOKENS_CHAT = 1024;

/** Token ceiling for the short follow-up suggestion call. */
export const CLAUDE_MAX_TOKENS_SUGGESTIONS = 200;
