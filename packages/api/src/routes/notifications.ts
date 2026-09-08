import { Hono } from 'hono';

export const notifications = new Hono();

notifications.post('/push', async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  return c.json(
    {
      error: 'Push notifications not yet implemented',
      received: body,
    },
    501
  );
});
