import { Hono } from 'hono';
import { respondIntent } from '../lib/intentError.js';
import { getPush, type PushTokenService } from '../lib/pushRuntime.js';
import { invalidJsonBody, limitBody, readJsonObject } from '../middleware/jsonBody.js';

const MAX_REQUEST_BYTES = 4 * 1024;

/** The service is built on first use, so a missing Arkiv setting fails only these routes, not startup. */
export function createPushRoutes(getService: () => PushTokenService = () => getPush().service) {
  const routes = new Hono();

  for (const action of ['register', 'unregister'] as const) {
    routes.post(`/${action}`, limitBody(MAX_REQUEST_BYTES), async (c) => {
      const body = await readJsonObject(c);
      if (!body) return invalidJsonBody(c);
      const request = body as { intent?: unknown; signature: string };
      // The path decides what is asked, so a signed register cannot be replayed as an unregister or the reverse.
      const intent =
        request.intent && typeof request.intent === 'object'
          ? { ...(request.intent as object), action }
          : request.intent;
      return respondIntent(c, () => getService().apply({ ...request, intent }));
    });
  }

  return routes;
}

export const push = createPushRoutes();
