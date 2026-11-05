import { describe, expect, it, vi } from 'vitest';
import { selectAuth } from '@/backends/auth/selectAuth';

const privyUser = {
  id: 'did:privy:1',
  linked_accounts: [{ type: 'email', address: 'a@b.co' }, { type: 'wallet' }],
};

function inputs(over: Partial<Parameters<typeof selectAuth>[0]> = {}) {
  return {
    kind: 'privy' as const,
    privy: { isReady: true, user: privyUser, logout: vi.fn(async () => {}) },
    personaId: null as string | null,
    signOutDev: vi.fn(),
    ...over,
  };
}

describe('selectAuth with Privy', () => {
  it('reports the Privy user with their email', () => {
    const session = selectAuth(inputs());
    expect(session.user).toEqual({ id: 'did:privy:1', kind: 'privy', email: 'a@b.co' });
    expect(session.isReady).toBe(true);
  });

  it('waits for Privy, and has no user when signed out', () => {
    expect(
      selectAuth(inputs({ privy: { isReady: false, user: null, logout: vi.fn() } })).isReady
    ).toBe(false);
    expect(
      selectAuth(inputs({ privy: { isReady: true, user: null, logout: vi.fn() } })).user
    ).toBeNull();
  });

  it('logs out through Privy', async () => {
    const i = inputs();
    await selectAuth(i).logout();
    expect(i.privy.logout).toHaveBeenCalled();
    expect(i.signOutDev).not.toHaveBeenCalled();
  });

  it('ignores a leftover developer session', () => {
    expect(
      selectAuth(
        inputs({ personaId: 'dhanya', privy: { isReady: true, user: null, logout: vi.fn() } })
      ).user
    ).toBeNull();
  });
});

describe('selectAuth with developer login', () => {
  it('is ready at once, since there is no service to wait for', () => {
    expect(selectAuth(inputs({ kind: 'dev' })).isReady).toBe(true);
  });

  it('signs in as the persona, ignoring Privy', () => {
    const session = selectAuth(inputs({ kind: 'dev', personaId: 'dhanya' }));
    expect(session.user).toEqual({ id: 'dev:dhanya', kind: 'dev' });
  });

  it('is signed out until a persona is chosen', () => {
    expect(selectAuth(inputs({ kind: 'dev' })).user).toBeNull();
  });

  it('logs out by ending the developer session, without calling Privy', async () => {
    const i = inputs({ kind: 'dev', personaId: 'dhanya' });
    await selectAuth(i).logout();
    expect(i.signOutDev).toHaveBeenCalled();
    expect(i.privy.logout).not.toHaveBeenCalled();
  });
});
