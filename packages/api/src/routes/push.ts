import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { IntentError } from '../lib/intentError.js';
import { getPush, type PushTokenService } from '../lib/pushRuntime.js';

const MAX_REQUEST_BYTES = 4 * 1024;

/** The service is built on first use, so a missing Arkiv setting fails only these routes, not startup. */
export function createPushRoutes(getService: () => PushTokenService = () => getPush().service) {
  const routes = new Hono();

  const respond = async (c: Context, run: () => Promise<unknown>) => {
    try {
      return c.json(await run());
    } catch (error) {
      if (!(error instanceof IntentError)) throw error;
      return c.json({ error: error.message, code: error.code }, error.status);
    }
  };

  for (const action of ['register', 'unregister'] as const) {
    routes.post(
      `/${action}`,
      bodyLimit({
        maxSize: MAX_REQUEST_BYTES,
        onError: (c) => c.json({ error: 'Payload too large' }, 413),
      }),
      async (c) => {
        const body = await c.req.json().catch(() => null);
        if (!body || typeof body !== 'object') return c.json({ error: 'Invalid JSON body' }, 400);
        const request = body as { intent?: unknown; signature: string };
        // The path decides what is asked, so a signed register cannot be replayed as an unregister or the reverse.
        const intent =
          request.intent && typeof request.intent === 'object'
            ? { ...(request.intent as object), action }
            : request.intent;
        return respond(c, () => getService().apply({ ...request, intent }));
      }
    );
  }

  return routes;
}

export const push = createPushRoutes();
