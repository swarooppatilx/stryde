import { describe, expect, it, vi } from 'vitest';
import { AccountDeleteError, createAccountDeleteService } from '../accountDelete.js';

const ME = '0x00000000000000000000000000000000000000aa' as const;
const NOW = 1_000_000;

function setup(verify: (...args: never[]) => Promise<boolean> = async () => true) {
  const order: string[] = [];
  const eraser = (name: string, count: number) =>
    vi.fn(async (owner: string) => {
      order.push(`${name}:${owner}`);
      return count;
    });
  const erasers = {
    follows: eraser('follows', 4),
    posts: eraser('posts', 2),
    about: eraser('about', 1),
    commentLikes: eraser('commentLikes', 3),
    reports: eraser('reports', 0),
    pushTokens: eraser('pushTokens', 1),
    beacons: eraser('beacons', 0),
  };
  const service = createAccountDeleteService({ erasers, verify: verify as never, now: () => NOW });
  return { erasers, order, service };
}

const intent = (overrides: Record<string, unknown> = {}) => ({
  owner: ME,
  deadline: NOW + 60,
  ...overrides,
});
const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (e: unknown) => (e instanceof AccountDeleteError ? e.code : 'other')
  );

describe('account deletion', () => {
  it('removes every kind of record for the signer and reports the counts', async () => {
    const { service, erasers } = setup();

    const result = await service.apply({ intent: intent(), signature: '0xs' });

    expect(result).toEqual({
      deleted: true,
      counts: {
        follows: 4,
        posts: 2,
        about: 1,
        commentLikes: 3,
        reports: 0,
        pushTokens: 1,
        beacons: 0,
      },
    });
    for (const eraser of Object.values(erasers)) expect(eraser).toHaveBeenCalledWith(ME);
  });

  it('removes one kind at a time, since the server signs them in order', async () => {
    const { service, order } = setup();

    await service.apply({ intent: intent(), signature: '0xs' });

    expect(order.map((o) => o.split(':')[0])).toEqual([
      'follows',
      'posts',
      'about',
      'commentLikes',
      'reports',
      'pushTokens',
      'beacons',
    ]);
  });

  it('deletes nothing when the signature does not match the owner', async () => {
    const { service, erasers } = setup(async () => false);

    expect(await code(service.apply({ intent: intent(), signature: '0xs' }))).toBe('bad_signature');
    for (const eraser of Object.values(erasers)) expect(eraser).not.toHaveBeenCalled();
  });

  it('refuses an expired or too-distant deadline', async () => {
    const { service } = setup();

    expect(
      await code(service.apply({ intent: intent({ deadline: NOW - 1 }), signature: '0xs' }))
    ).toBe('expired');
    expect(
      await code(service.apply({ intent: intent({ deadline: NOW + 100_000 }), signature: '0xs' }))
    ).toBe('expired');
  });

  it.each([[{ owner: 'nope' }], [{ deadline: 'soon' }]])(
    'refuses a malformed intent %j',
    async (override) => {
      const { service, erasers } = setup();

      expect(await code(service.apply({ intent: intent(override), signature: '0xs' }))).toBe(
        'invalid'
      );
      expect(erasers.follows).not.toHaveBeenCalled();
    }
  );

  it('refuses a missing signature and a missing intent', async () => {
    const { service } = setup();

    expect(await code(service.apply({ intent: intent(), signature: '' }))).toBe('invalid');
    expect(await code(service.apply({ intent: undefined, signature: '0xs' }))).toBe('invalid');
  });

  it('can be repeated after a failure part-way: nothing already removed is counted again', async () => {
    const { service, erasers } = setup();
    erasers.posts.mockRejectedValueOnce(new Error('node down'));

    await expect(service.apply({ intent: intent(), signature: '0xs' })).rejects.toThrow(
      'node down'
    );
    erasers.follows.mockResolvedValueOnce(0);
    const retry = await service.apply({ intent: intent(), signature: '0xs' });

    expect(retry.counts.follows).toBe(0);
    expect(retry.deleted).toBe(true);
  });
});
