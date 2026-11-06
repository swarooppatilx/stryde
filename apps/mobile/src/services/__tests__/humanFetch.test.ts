import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrydeApiError } from '@/services/strydeApi';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('@/services/strydeApi', async (original) => ({
  ...(await original<typeof import('@/services/strydeApi')>()),
  apiFetch,
}));
vi.mock('expo-linking', () => ({ openURL: vi.fn() }));
vi.mock('react-native', () => ({
  AppState: { addEventListener: vi.fn() },
  Platform: { OS: 'ios' },
}));

const { humanFetch } = await import('@/services/humanPassService');

const address = '0x00000000000000000000000000000000000000aa' as const;
const signMessage = vi.fn();
const auth = { wallet: { signMessage, account: { address } }, address } as never;

const headersOf = (i: number) =>
  ((apiFetch.mock.calls[i] as unknown[])[1] as { headers: Record<string, string> }).headers;

beforeEach(() => {
  apiFetch.mockReset();
  signMessage.mockReset().mockResolvedValue('0xsigned');
});

describe('humanFetch', () => {
  it('opens a session once and sends its bearer token on coach calls', async () => {
    apiFetch.mockImplementation(async (path: string) =>
      path === '/human/session'
        ? { token: 'stryde_human_tok1', expiresAt: Date.now() + 3_600_000 }
        : { ok: true }
    );
    // A distinct address from the other tests so no session is cached from before.
    const a = {
      ...(auth as object),
      address: '0x00000000000000000000000000000000000000b1',
    } as never;
    await humanFetch(a, '/coach/plan', { method: 'POST', body: '{}' });
    await humanFetch(a, '/coach/review', { method: 'POST', body: '{}' });

    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(signMessage.mock.calls[0]?.[0].message).toContain('Stryde Coach session');
    expect(apiFetch.mock.calls.map((c) => c[0])).toEqual([
      '/human/session',
      '/coach/plan',
      '/coach/review',
    ]);
    expect(headersOf(1).Authorization).toBe('Bearer stryde_human_tok1');
    expect(headersOf(2).Authorization).toBe('Bearer stryde_human_tok1');
  });

  it('signs in again, once, when the server no longer knows the session', async () => {
    let tokens = 0;
    let coachCalls = 0;
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/human/session') {
        tokens += 1;
        return { token: `stryde_human_t${tokens}`, expiresAt: Date.now() + 3_600_000 };
      }
      coachCalls += 1;
      if (coachCalls === 1) {
        throw new StrydeApiError('Sign in', 401, { code: 'session_required' });
      }
      return { ok: true };
    });
    const b = {
      ...(auth as object),
      address: '0x00000000000000000000000000000000000000b2',
    } as never;
    await expect(humanFetch(b, '/coach/plan', { method: 'POST', body: '{}' })).resolves.toEqual({
      ok: true,
    });
    expect(tokens).toBe(2);
    expect(headersOf(1).Authorization).toBe('Bearer stryde_human_t1');
    expect(headersOf(3).Authorization).toBe('Bearer stryde_human_t2');
  });

  it('does not hide other errors', async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/human/session') {
        return { token: 'stryde_human_t9', expiresAt: Date.now() + 3_600_000 };
      }
      throw new StrydeApiError('daily limit', 429, { code: 'daily_limit' });
    });
    const c = {
      ...(auth as object),
      address: '0x00000000000000000000000000000000000000b3',
    } as never;
    await expect(humanFetch(c, '/coach/plan', {})).rejects.toMatchObject({ status: 429 });
  });
});
