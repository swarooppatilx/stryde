import { describe, expect, it, vi } from 'vitest';
import {
  createOutbox,
  type Handlers,
  type OutboxEntry,
  RejectedError,
} from '@/backends/outbox/outbox';
import { FakeClock, MemoryStorage, SequentialIds } from '@/platform/fakes';
import { BACKOFF_BASE_MS, MAX_AUTO_ATTEMPTS } from '@/utils/syncSchedule';

function setup(handlers: Handlers, over: { online?: () => boolean } = {}) {
  const storage = new MemoryStorage();
  const clock = new FakeClock();
  const rejected: Array<{ entry: OutboxEntry; reason: string }> = [];
  const make = () =>
    createOutbox({
      storage,
      clock,
      ids: new SequentialIds(),
      handlers,
      isOnline: over.online ?? (() => true),
      onRejected: (entry, reason) => rejected.push({ entry, reason }),
    });
  return { outbox: make(), make, storage, clock, rejected };
}

const ok = () => vi.fn(async () => {});

describe('enqueue', () => {
  it('records an intent as pending and tells subscribers', async () => {
    const { outbox } = setup({ ping: ok() });
    const listener = vi.fn();
    outbox.subscribe(listener);

    const entry = await outbox.enqueue({ kind: 'ping', payload: { n: 1 } });

    expect(entry).toMatchObject({
      kind: 'ping',
      payload: { n: 1 },
      status: 'pending',
      attempts: 0,
    });
    expect(outbox.entries()).toHaveLength(1);
    expect(listener).toHaveBeenCalled();
  });

  it('replaces a waiting intent that has the same key, so the latest wish wins', async () => {
    const ping = ok();
    const { outbox } = setup({ ping });

    await outbox.enqueue({ kind: 'ping', payload: { on: true }, key: 'kudos:a' });
    await outbox.enqueue({ kind: 'ping', payload: { on: false }, key: 'kudos:a' });
    await outbox.drain();

    expect(ping).toHaveBeenCalledTimes(1);
    expect(ping).toHaveBeenCalledWith({ on: false });
  });

  it('keeps a newer intent that arrives while the same key is being delivered', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls: unknown[] = [];
    const { outbox } = setup({
      ping: async (payload) => {
        calls.push(payload);
        if (calls.length === 1) await gate;
      },
    });

    await outbox.enqueue({ kind: 'ping', payload: 'first', key: 'k' });
    const draining = outbox.drain();
    await vi.waitFor(() => expect(calls).toEqual(['first']));
    await outbox.enqueue({ kind: 'ping', payload: 'second', key: 'k' });
    release();
    await draining;
    await outbox.drain();

    expect(calls).toEqual(['first', 'second']);
    expect(outbox.entries()).toHaveLength(0);
  });
});

describe('drain', () => {
  it('delivers in the order intents were made and removes what was delivered', async () => {
    const seen: string[] = [];
    const { outbox } = setup({
      ping: async (p) => {
        seen.push(String(p));
      },
    });

    await outbox.enqueue({ kind: 'ping', payload: 'a' });
    await outbox.enqueue({ kind: 'ping', payload: 'b' });
    await outbox.drain();

    expect(seen).toEqual(['a', 'b']);
    expect(outbox.entries()).toEqual([]);
  });

  it('does nothing while offline', async () => {
    const ping = ok();
    const { outbox } = setup({ ping }, { online: () => false });

    await outbox.enqueue({ kind: 'ping', payload: 1 });
    await outbox.drain();

    expect(ping).not.toHaveBeenCalled();
    expect(outbox.entries()).toHaveLength(1);
  });

  it('backs off after a failure and stops, then retries once the wait has passed', async () => {
    const ping = vi.fn(async () => {
      throw new Error('rpc down');
    });
    const { outbox, clock } = setup({ ping });

    await outbox.enqueue({ kind: 'ping', payload: 1 });
    await outbox.enqueue({ kind: 'ping', payload: 2 });
    await outbox.drain();

    expect(ping).toHaveBeenCalledTimes(1);
    expect(outbox.entries()[0]).toMatchObject({
      attempts: 1,
      lastError: 'rpc down',
      nextAttemptAt: clock.now() + BACKOFF_BASE_MS,
    });

    await outbox.drain();
    expect(ping).toHaveBeenCalledTimes(1);

    clock.advance(BACKOFF_BASE_MS);
    await outbox.drain();
    expect(ping).toHaveBeenCalledTimes(2);
  });

  it('remembers when it first failed, keeps that through retries, and forgets it on a manual retry', async () => {
    const ping = vi.fn(async () => {
      throw new Error('rpc down');
    });
    const { outbox, clock } = setup({ ping });

    await outbox.enqueue({ kind: 'ping', payload: 1 });
    clock.advance(5000);
    const firstAt = clock.now();
    await outbox.drain();
    expect(outbox.entries()[0]?.firstFailedAt).toBe(firstAt);

    clock.advance(BACKOFF_BASE_MS);
    await outbox.drain();
    expect(outbox.entries()[0]).toMatchObject({ attempts: 2, firstFailedAt: firstAt });

    const id = outbox.entries()[0]?.id ?? '';
    await outbox.retry(id);
    expect(outbox.entries()[0]?.firstFailedAt).toBeUndefined();
  });

  it('drops a definite rejection and reports it, so the app can undo its optimistic change', async () => {
    const { outbox, rejected } = setup({
      ping: async () => {
        throw new RejectedError('username taken');
      },
    });

    await outbox.enqueue({ kind: 'ping', payload: 'x' });
    await outbox.drain();

    expect(outbox.entries()).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBe('username taken');
    expect(rejected[0]?.entry.payload).toBe('x');
  });

  it('remembers a rejected key before anyone is told the entry left, and tells only once', async () => {
    const { outbox } = setup({
      ping: async () => {
        throw new RejectedError('no');
      },
    });
    // The queue is empty both when it loads and when the entry leaves; only the second has a rejection.
    const answers: boolean[] = [];
    outbox.subscribe(() => {
      if (outbox.entries().length === 0) answers.push(outbox.consumeRejection('k:1'));
    });

    await outbox.enqueue({ kind: 'ping', payload: 'x', key: 'k:1' });
    await outbox.drain();

    expect(answers).toContain(true);
    expect(outbox.consumeRejection('k:1')).toBe(false);
  });

  it('does not mark a delivered change as rejected', async () => {
    const { outbox } = setup({ ping: ok() });
    await outbox.enqueue({ kind: 'ping', payload: 'x', key: 'k:1' });
    await outbox.drain();

    expect(outbox.consumeRejection('k:1')).toBe(false);
  });

  it('gives up on its own after the attempt limit, and a manual retry starts it afresh', async () => {
    const ping = vi.fn(async () => {
      throw new Error('nope');
    });
    const { outbox, clock } = setup({ ping });
    const entry = await outbox.enqueue({ kind: 'ping', payload: 1 });

    for (let i = 0; i < MAX_AUTO_ATTEMPTS + 2; i++) {
      await outbox.drain();
      clock.advance(60 * 60_000);
    }
    expect(ping).toHaveBeenCalledTimes(MAX_AUTO_ATTEMPTS);
    expect(outbox.entries()[0]?.status).toBe('failed');

    await outbox.retry(entry.id);
    expect(outbox.entries()[0]).toMatchObject({ status: 'pending', attempts: 0 });
    await outbox.drain();
    expect(ping).toHaveBeenCalledTimes(MAX_AUTO_ATTEMPTS + 1);
  });

  it('leaves an intent with no handler waiting instead of failing it', async () => {
    const { outbox } = setup({});

    await outbox.enqueue({ kind: 'unknown', payload: 1 });
    await outbox.drain();

    expect(outbox.entries()[0]).toMatchObject({ status: 'pending', attempts: 0 });
  });

  it('runs one drain at a time', async () => {
    const ping = ok();
    const { outbox } = setup({ ping });

    await outbox.enqueue({ kind: 'ping', payload: 1 });
    await Promise.all([outbox.drain(), outbox.drain()]);

    expect(ping).toHaveBeenCalledTimes(1);
  });
});

describe('persistence', () => {
  it('brings waiting intents back after a restart', async () => {
    const { outbox, make } = setup({ ping: ok() });
    await outbox.enqueue({ kind: 'ping', payload: { n: 7 }, key: 'k' });

    const again = make();
    await again.hydrate();

    expect(again.entries()).toHaveLength(1);
    expect(again.entries()[0]).toMatchObject({ kind: 'ping', payload: { n: 7 }, key: 'k' });
  });

  it('does not bring back what was already delivered', async () => {
    const { outbox, make } = setup({ ping: ok() });
    await outbox.enqueue({ kind: 'ping', payload: 1 });
    await outbox.drain();

    const again = make();
    await again.hydrate();

    expect(again.entries()).toEqual([]);
  });

  it('starts empty when the saved data is damaged', async () => {
    const { make, storage } = setup({});
    await storage.setItem('@stryde/outbox', '{not json');

    const outbox = make();
    await outbox.hydrate();

    expect(outbox.entries()).toEqual([]);
  });
});

describe('hydration', () => {
  it('runs once, and an intent added while it loads is not lost', async () => {
    const { outbox, storage } = setup({ ping: ok() });
    await storage.setItem(
      '@stryde/outbox',
      JSON.stringify([
        {
          id: 'old',
          kind: 'ping',
          payload: 1,
          createdAt: 0,
          attempts: 0,
          nextAttemptAt: 0,
          status: 'pending',
        },
      ])
    );

    const first = outbox.hydrate();
    const added = outbox.enqueue({ kind: 'ping', payload: 2 });
    await Promise.all([first, added, outbox.hydrate()]);

    expect(outbox.entries().map((e) => e.payload)).toEqual([1, 2]);
  });
});

describe('status helpers', () => {
  it('reports what is waiting for a key and how many in total', async () => {
    const { outbox } = setup({ ping: ok() });

    await outbox.enqueue({ kind: 'ping', payload: 1, key: 'kudos:a' });
    await outbox.enqueue({ kind: 'ping', payload: 2 });

    expect(outbox.statusOf('kudos:a')).toBe('pending');
    expect(outbox.statusOf('kudos:b')).toBeUndefined();
    expect(outbox.pendingCount()).toBe(2);
  });

  it('hands out the same array until something changes, so a hook can tell', async () => {
    const { outbox } = setup({ ping: ok() });
    const before = outbox.entries();
    await outbox.enqueue({ kind: 'ping', payload: 1 });

    expect(outbox.entries()).not.toBe(before);
    expect(outbox.entries()).toBe(outbox.entries());
  });
});

describe('clear', () => {
  it('drops everything waiting, so nothing from a signed-out account is sent later', async () => {
    const { outbox, make } = setup({ ping: ok() });
    await outbox.enqueue({ kind: 'ping', payload: 1, key: 'a' });
    await outbox.enqueue({ kind: 'ping', payload: 2, key: 'b' });
    const listener = vi.fn();
    outbox.subscribe(listener);

    await outbox.clear();

    expect(outbox.entries()).toEqual([]);
    expect(listener).toHaveBeenCalled();
    const reopened = make();
    await reopened.hydrate();
    expect(reopened.entries()).toEqual([]);
  });
});

describe('refusal bookkeeping and clear', () => {
  it('a fresh enqueue under the same key forgets an old refusal', async () => {
    const { outbox } = setup({
      ping: vi.fn(async () => {
        throw new RejectedError('no');
      }),
    });
    await outbox.enqueue({ kind: 'ping', payload: 1, key: 'k:1' });
    await outbox.drain();
    await outbox.enqueue({ kind: 'ping', payload: 2, key: 'k:1' });
    expect(outbox.consumeRejection('k:1')).toBe(false);
  });

  it('clear forgets refusals and counts itself', async () => {
    const { outbox } = setup({
      ping: vi.fn(async () => {
        throw new RejectedError('no');
      }),
    });
    await outbox.enqueue({ kind: 'ping', payload: 1, key: 'k:1' });
    await outbox.drain();
    expect(outbox.clearCount()).toBe(0);
    await outbox.clear();
    expect(outbox.clearCount()).toBe(1);
    expect(outbox.consumeRejection('k:1')).toBe(false);
  });
});
