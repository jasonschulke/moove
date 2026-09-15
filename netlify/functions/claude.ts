
/**
 * Server-side proxy for the Anthropic Messages API.
 *
 * Exists so that Moove can talk to Claude without a key ever reaching the
 * browser. The key lives in the ANTHROPIC_API_KEY environment variable on
 * Netlify and is never returned to the client.
 *
 * The client only sends the parts of the request it is allowed to choose:
 * model, max_tokens, system and messages. Anything else is ignored.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/** Hard ceiling, so a client cannot ask for an unbounded (expensive) reply. */
const MAX_TOKENS_LIMIT = 4096;

interface ProxyRequest {
  model?: string;
  max_tokens?: number;
  system?: string;
  messages?: Array<{ role: string; content: string }>;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return json({ error: { message: 'Method not allowed' } }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(
      { error: { message: 'The Claude proxy is not configured. Set ANTHROPIC_API_KEY on the deploy, or add your own key in Settings.' } },
      501,
    );
  }

  let body: ProxyRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: { message: 'Malformed request body' } }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: { message: 'messages is required' } }, 400);
  }

  const payload = {
    model: body.model,
    max_tokens: Math.min(body.max_tokens ?? 1024, MAX_TOKENS_LIMIT),
    ...(body.system ? { system: body.system } : {}),
    messages: body.messages,
  };

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(payload),
    });

    // Pass the upstream body and status straight through so the client can
    // surface real API errors, but never any header that could carry the key.
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Claude proxy request failed:', err);
    return json({ error: { message: 'Upstream request failed' } }, 502);
  }
};
