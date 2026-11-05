import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: () => ({ remove: () => {} }) },
}));
vi.mock('expo-linking', () => ({ openURL: vi.fn(async () => true) }));
vi.mock('@/constants/config', () => ({
  ENV: { WORLD_APP_ID: 'app', WORLD_RP_ID: 'rp', API_URL: 'http://api', API_KEY: '' },
}));

import { runSelfieCheck } from '@/services/worldIdService';

type Reply = { ok: boolean; status?: number; body: unknown } | Error;

/** Answers `fetch` in order: the session create first, then each poll. */
function script(...replies: Reply[]) {
  const queue = [...replies];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const next = queue.shift();
      if (!next) throw new Error('unexpected extra request');
      if (next instanceof Error) throw next;
      return new Response(JSON.stringify(next.body), {
        status: next.ok ? 200 : (next.status ?? 500),
      });
    })
  );
}

const WALLET = '0x00000000000000000000000000000000000000aa';
const SESSION: Reply = { ok: true, body: { sessionId: 's1', connectorURI: 'worldapp://x' } };
const PENDING: Reply = { ok: true, body: { status: 'pending' } };
const confirmed = (response: Record<string, unknown>): Reply => ({
  ok: true,
  body: { status: 'confirmed', result: { responses: [response] } },
});

/** Runs the check while advancing the poll clock until it settles. */
async function run() {
  const settled = runSelfieCheck(WALLET).then(
    (value) => ({ value }),
    (error: unknown) => ({ error })
  );
  await vi.advanceTimersByTimeAsync(10 * 60_000);
  return settled;
}

describe('runSelfieCheck', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks the person to sign in first instead of calling World with a placeholder identity', async () => {
    script();

    await expect(runSelfieCheck('current')).rejects.toThrow(/sign in/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns the nullifier once World confirms', async () => {
    script(SESSION, PENDING, confirmed({ nullifier: '0xn1' }));

    expect(await run()).toMatchObject({ value: { nullifier: '0xn1' } });
  });

  it('reads the older nullifier_hash and session_nullifier shapes', async () => {
    script(SESSION, confirmed({ nullifier_hash: '0xold' }));
    expect(await run()).toMatchObject({ value: { nullifier: '0xold' } });

    script(SESSION, confirmed({ session_nullifier: ['0xsess'] }));
    expect(await run()).toMatchObject({ value: { nullifier: '0xsess' } });
  });

  it('survives a dropped connection while the user is in the World app', async () => {
    script(
      SESSION,
      PENDING,
      new TypeError('Network request failed'),
      confirmed({ nullifier: '0xn' })
    );

    expect(await run()).toMatchObject({ value: { nullifier: '0xn' } });
  });

  it('treats "too many requests" while polling as "not yet", not as a failure', async () => {
    script(
      SESSION,
      { ok: false, status: 429, body: { error: 'Too many requests' } },
      confirmed({ nullifier: '0xn' })
    );

    expect(await run()).toMatchObject({ value: { nullifier: '0xn' } });
  });

  it('keeps polling through a server hiccup, but stops when the session is gone', async () => {
    script(
      SESSION,
      { ok: false, status: 502, body: { error: 'try again' } },
      confirmed({ nullifier: '0xn' })
    );
    expect(await run()).toMatchObject({ value: { nullifier: '0xn' } });

    script(SESSION, { ok: false, status: 404, body: { error: 'Session not found or expired.' } });
    expect(await run()).toMatchObject({
      error: expect.objectContaining({ message: 'Session not found or expired.' }),
    });
  });

  it('explains a dismissed verification', async () => {
    script(SESSION, { ok: true, body: { status: 'failed', error: 'user_cancelled' } });

    expect(await run()).toMatchObject({ error: { code: 'cancelled' } });
  });

  it('reports a timeout when World never answers', async () => {
    script(SESSION, ...Array.from({ length: 200 }, () => PENDING));

    expect(await run()).toMatchObject({ error: { code: 'timeout' } });
  });

  it('stops at a server rejection instead of polling for minutes', async () => {
    script(SESSION, { ok: false, status: 404, body: { error: 'unknown session' } });

    expect(await run()).toMatchObject({
      error: expect.objectContaining({ message: 'unknown session' }),
    });
  });

  it('fails clearly when the proof carries no nullifier', async () => {
    script(SESSION, confirmed({ something: 'else' }));

    const result = await run();
    expect(String((result as { error: Error }).error)).toContain('no nullifier');
  });
});
