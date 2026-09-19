import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let subgraphUrl: string | undefined = 'https://graph.test/q';

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return { ...actual, getActiveConfig: () => ({ subgraphUrl }) };
});

const { getProfileAvatarsFromSubgraph, getProfilesFromSubgraph } = await import('../subgraph');

let sent: { query: string }[];
let profiles: unknown[];

beforeEach(() => {
  subgraphUrl = 'https://graph.test/q';
  sent = [];
  profiles = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      // One page, shorter than the page size, so the read stops after it.
      return { ok: true, json: async () => ({ data: { profiles } }) };
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('getProfileAvatarsFromSubgraph', () => {
  it('has nothing to say without a subgraph, so callers can fall back', async () => {
    subgraphUrl = undefined;

    expect(await getProfileAvatarsFromSubgraph()).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it('maps lower-cased wallets to their avatar ids, skipping a profile with none', async () => {
    profiles = [
      { id: '0x00000000000000000000000000000000000000AA', avatarCid: 'bafy-a' },
      { id: '0x00000000000000000000000000000000000000bb', avatarCid: null },
    ];

    const avatars = await getProfileAvatarsFromSubgraph();

    expect([...(avatars ?? [])]).toEqual([
      ['0x00000000000000000000000000000000000000aa', 'bafy-a'],
    ]);
  });

  it('only asks for profiles that have an avatar', async () => {
    await getProfileAvatarsFromSubgraph();

    expect(sent[0]?.query).toContain('avatarCid_not: null');
  });
});

describe('getProfilesFromSubgraph', () => {
  it('has nothing to say without a subgraph', async () => {
    subgraphUrl = undefined;

    expect(await getProfilesFromSubgraph()).toBeNull();
  });

  it('lists each profile as wallet, username and verified flag', async () => {
    profiles = [
      { id: '0xaa', username: 'asha_runs', isVerified: true },
      { id: '0xbb', username: 'dev_cycles', isVerified: false },
    ];

    expect(await getProfilesFromSubgraph()).toEqual([
      { wallet: '0xaa', username: 'asha_runs', isVerified: true },
      { wallet: '0xbb', username: 'dev_cycles', isVerified: false },
    ]);
  });
});
