import { describe, expect, it, vi } from 'vitest';
import { PushTokenError } from '../../lib/pushTokens.js';
import { createPushRoutes } from '../push.js';

const post = (app: ReturnType<typeof createPushRoutes>, path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /register and /unregister', () => {
  it('registers with the action the path names', async () => {
    const apply = vi.fn().mockResolvedValue({ registered: true, created: true });
    const app = createPushRoutes(() => ({ apply }) as never);

    const res = await post(app, '/register', { intent: { owner: '0xaa' }, signature: '0xs' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ registered: true, created: true });
    expect(apply).toHaveBeenCalledWith({
      intent: { owner: '0xaa', action: 'register' },
      signature: '0xs',
    });
  });

  it('unregisters on its own path', async () => {
    const apply = vi.fn().mockResolvedValue({ registered: false });
    const app = createPushRoutes(() => ({ apply }) as never);

    await post(app, '/unregister', { intent: {}, signature: '0xs' });

    expect(apply.mock.calls[0]?.[0].intent.action).toBe('unregister');
  });

  it.each([
    ['invalid', 400],
    ['bad_signature', 401],
  ] as const)('maps a %s refusal to HTTP %i', async (code, status) => {
    const apply = vi.fn().mockRejectedValue(new PushTokenError(code, 'nope'));

    const res = await post(
      createPushRoutes(() => ({ apply }) as never),
      '/register',
      {}
    );

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: 'nope', code });
  });

  it('answers 400 for a body that is not JSON', async () => {
    const res = await createPushRoutes(() => ({ apply: vi.fn() }) as never).request('/register', {
      method: 'POST',
      body: 'x',
    });

    expect(res.status).toBe(400);
  });
});
