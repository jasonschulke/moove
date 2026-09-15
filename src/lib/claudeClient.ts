/**
 * One place that decides how Moove reaches the Anthropic API.
 *
 * Two routes:
 *
 *  - The user has supplied their own key in Settings. The browser calls
 *    Anthropic directly with it. Their key, their account, and it works
 *    without anything deployed.
 *
 *  - No user key, and VITE_CLAUDE_PROXY is enabled. The browser calls the
 *    Netlify function, which holds the key server-side. Nothing secret
 *    reaches the client.
 *
 * There is deliberately no third route. An embedded fallback key used to live
 * in storage.ts; it shipped in the bundle and was recoverable by anyone who
 * opened the site.
 */

import { CLAUDE_MODEL } from '../config';
import { getClaudeApiKey } from '../data/storage';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const PROXY_URL = '/.netlify/functions/claude';
const ANTHROPIC_VERSION = '2023-06-01';

/** Whether the deployment has a server-side proxy available. */
export const isProxyEnabled = (): boolean =>
  String(import.meta.env.VITE_CLAUDE_PROXY ?? '').toLowerCase() === 'true';

/** Whether the coach can be used at all on this device. */
export const isClaudeAvailable = (): boolean => !!getClaudeApiKey() || isProxyEnabled();

export interface ClaudeMessage {
  role: string;
  content: string;
}

export interface ClaudeRequest {
  messages: ClaudeMessage[];
  system?: string;
  maxTokens: number;
}

/**
 * Send a request to Claude and return the first text block.
 * Throws with the API's own message when the request fails.
 */
export async function sendToClaude({ messages, system, maxTokens }: ClaudeRequest): Promise<string> {
  const userKey = getClaudeApiKey();

  const payload = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };

  const response = userKey
    ? await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': userKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(payload),
      })
    : await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = errorData.error?.message;

    // A 404 here is the model, not the key or the route, and the API says so
    // in a shape no one can read: the whole message is "model: <id>".
    if (response.status === 404) {
      throw new Error(
        `The coach is set to a model this key cannot reach: ${CLAUDE_MODEL}. ` +
        'It may have been retired. Set VITE_CLAUDE_MODEL to a current one.');
    }
    if (response.status === 401) {
      throw new Error('That API key was refused. Check it in Settings.');
    }
    throw new Error(detail || `The API returned ${response.status}.`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}
