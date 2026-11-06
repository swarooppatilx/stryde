import { describe, expect, it, vi } from 'vitest';
import { AccountDeleteError } from '../../lib/accountDelete.js';
import { createAccountRoutes } from '../account.js';

const post = (app: ReturnType<typeof createAccountRoutes>, body: unknown) =>
  app.request('/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /delete', () => {
  it('passes the signed intent on and returns the counts', async () => {
    const result = { deleted: true, counts: { follows: 1 } };
    const apply = vi.fn().mockResolvedValue(result);
    const app = createAccountRoutes(() => ({ apply }) as never);

    const res = await post(app, { intent: { owner: '0xaa' }, signature: '0xs' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(result);
    expect(apply).toHaveBeenCalledWith({ intent: { owner: '0xaa' }, signature: '0xs' });
  });

  it.each([
    ['invalid', 400],
    ['expired', 400],
    ['bad_signature', 401],
  ] as const)('maps a %s refusal to HTTP %i', async (code, status) => {
    const apply = vi.fn().mockRejectedValue(new AccountDeleteError(code, 'nope'));

    const res = await post(
      createAccountRoutes(() => ({ apply }) as never),
      {}
    );

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: 'nope', code });
  });

  it('refuses a body that is not JSON', async () => {
    const app = createAccountRoutes(() => ({ apply: vi.fn() }) as never);

    const res = await app.request('/delete', { method: 'POST', body: 'x' });

    expect(res.status).toBe(400);
  });
});
