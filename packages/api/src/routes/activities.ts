import { Hono } from 'hono';

export const activities = new Hono();

activities.post('/validate', async (c) => {
  // TODO: validate GPS data, compute activity hash
  // This is the trusted oracle endpoint — backend validates before contract recording
  await c.req.json();

  return c.json({
    valid: true,
    hash: '0x...', // keccak256(polyline, territoryArea, metadata)
  });
});
