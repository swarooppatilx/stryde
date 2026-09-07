import { Hono } from 'hono';

export const notifications = new Hono();

notifications.post('/push', async (c) => {
  // TODO: send push notification via Expo
  // Expo push token + message
  await c.req.json();

  return c.json({
    sent: true,
    tickets: [],
  });
});
