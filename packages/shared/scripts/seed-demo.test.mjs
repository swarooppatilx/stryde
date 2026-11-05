import { describe, expect, it } from 'vitest';
import {
  buildActivity,
  DEMO_ATHLETES,
  haversineMeters,
  loopRoute,
  parseSeedArgs,
  routeLength,
  runSeed,
  seedPlan,
} from './seed-demo.mjs';

const PUNE = [73.8567, 18.5204];

describe('loopRoute', () => {
  it('is a closed loop whose length is the requested distance', () => {
    const route = loopRoute(PUNE, 5000);

    expect(route[0]).toEqual(route.at(-1));
    expect(routeLength(route)).toBeGreaterThan(5000 * 0.98);
    expect(routeLength(route)).toBeLessThan(5000 * 1.02);
  });

  it('stays near its centre', () => {
    for (const [lng, lat] of loopRoute(PUNE, 3000)) {
      expect(haversineMeters(PUNE, [lng, lat])).toBeLessThan(1000);
    }
  });
});

describe('buildActivity', () => {
  it('derives time from distance and pace, and encodes the route as the app does', () => {
    const activity = buildActivity(
      { name: 'Easy 5K', type: 'run', km: 5, paceMinPerKm: 6, daysAgo: 1 },
      { username: 'asha', center: PUNE },
      0
    );

    expect(activity.distance).toBeGreaterThan(4900);
    expect(activity.duration).toBeCloseTo((activity.distance / 1000) * 6 * 60_000, -3);
    expect(activity.polyline.split(';').length).toBe(activity.coordinates.length);
    expect(haversineMeters(PUNE, activity.coordinates[0])).toBeLessThan(1500);
    expect(activity.metadata).toBe('seed-asha-0');
  });
});

describe('DEMO_ATHLETES', () => {
  it('has distinct usernames within the 32 character limit', () => {
    const names = DEMO_ATHLETES.map((a) => a.username);

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name.length).toBeLessThanOrEqual(32);
  });

  it('gives every recorded activity a different route, so no two hash alike', () => {
    const polylines = DEMO_ATHLETES.flatMap((athlete) =>
      athlete.activities.map((spec, i) => buildActivity(spec, athlete, i).polyline)
    );

    expect(new Set(polylines).size).toBe(polylines.length);
  });
});

describe('seedPlan', () => {
  const state = (overrides = {}) => ({
    registered: false,
    balanceWei: 0n,
    activityCount: 0,
    following: [],
    ...overrides,
  });

  it('does everything for a brand new athlete', () => {
    const athlete = DEMO_ATHLETES[0];
    const plan = seedPlan(athlete, state(), { demoAddress: '0xdemo', others: ['0xother'] });

    expect(plan.fund).toBe(true);
    expect(plan.register).toBe(true);
    expect(plan.activitiesToRecord).toBe(athlete.activities.length);
    expect(plan.follow.sort()).toEqual(['0xdemo', '0xother']);
  });

  it('does nothing when the athlete is already fully seeded, so a re-run is safe', () => {
    const athlete = DEMO_ATHLETES[0];
    const plan = seedPlan(
      athlete,
      state({
        registered: true,
        balanceWei: 10n ** 16n,
        activityCount: athlete.activities.length,
        following: ['0xdemo'],
      }),
      { demoAddress: '0xdemo', others: [] }
    );

    expect(plan).toEqual({ fund: false, register: false, activitiesToRecord: 0, follow: [] });
  });

  it('records only the activities still missing', () => {
    const athlete = DEMO_ATHLETES[0];
    const plan = seedPlan(athlete, state({ registered: true, activityCount: 1 }), {
      demoAddress: null,
      others: [],
    });

    expect(plan.activitiesToRecord).toBe(athlete.activities.length - 1);
  });
});

describe('parseSeedArgs', () => {
  it('is a dry run unless --yes is given', () => {
    expect(parseSeedArgs([], { API_URL: 'http://x', RELAYER_PRIVATE_KEY: '0xk' }).write).toBe(
      false
    );
    expect(
      parseSeedArgs(['--yes'], { API_URL: 'http://x', RELAYER_PRIVATE_KEY: '0xk' }).write
    ).toBe(true);
  });

  it('needs the API and the relayer key', () => {
    expect(() => parseSeedArgs([], { RELAYER_PRIVATE_KEY: '0xk' })).toThrow(/API_URL/);
    expect(() => parseSeedArgs([], { API_URL: 'http://x' })).toThrow(/RELAYER_PRIVATE_KEY/);
  });
});

/** An in-memory Sepolia: just enough of the services the seed script calls. */
function fakeWorld({ failRecord = false } = {}) {
  const chain = {
    registered: new Set(),
    balances: new Map(),
    activities: new Map(),
    follows: new Map(),
    kudos: [],
    metadata: [],
    funded: [],
    calls: [],
    nextId: 1n,
  };
  const addressOf = (wallet) => wallet.address;
  const services = {
    client: { getBalance: async (a) => chain.balances.get(a) ?? 0n },
    profile: {
      isRegistered: async (a) => chain.registered.has(a),
      register: async (wallet) => {
        chain.calls.push(`register:${addressOf(wallet)}`);
        chain.registered.add(addressOf(wallet));
        return { profileId: 1n };
      },
    },
    activity: {
      getActivityCount: async (a) => BigInt(chain.activities.get(a) ?? 0),
      recordActivity: async (wallet) => {
        chain.calls.push(`record:${addressOf(wallet)}`);
        if (failRecord) return { confirmed: false, activityId: 0n };
        chain.activities.set(addressOf(wallet), (chain.activities.get(addressOf(wallet)) ?? 0) + 1);
        return { confirmed: true, activityId: chain.nextId++ };
      },
      uploadAndSetActivityMetadata: async (wallet, activityId, metadata) => {
        chain.metadata.push({ owner: addressOf(wallet), activityId, name: metadata.name });
      },
    },
    follows: {
      getFollowing: async (a) => ({ addresses: chain.follows.get(a) ?? [] }),
      setFollowing: async (wallet, followee) => {
        const from = addressOf(wallet);
        chain.follows.set(from, [...(chain.follows.get(from) ?? []), followee]);
      },
    },
    social: {
      toggleKudos: async (wallet, activityId) => {
        chain.kudos.push({ from: addressOf(wallet), activityId });
      },
    },
  };
  const accounts = DEMO_ATHLETES.map((athlete, i) => ({
    athlete,
    privateKey: `key${i}`,
    address: `0xa${i}`,
  }));
  // The script derives each wallet from a key; the fake keeps the address on the wallet itself.
  const wallets = new Map(accounts.map((a) => [a.privateKey, { address: a.address }]));
  services.client.getWalletClient = (key) => wallets.get(key);
  const relayer = {
    sendTransaction: async ({ to, value }) => {
      chain.funded.push(to);
      chain.balances.set(to, (chain.balances.get(to) ?? 0n) + value);
      return `0xhash${chain.funded.length}`;
    },
  };
  const publicClient = { waitForTransactionReceipt: async () => ({}) };
  return { chain, services, accounts, relayer, publicClient };
}

const seedConfig = (write) => ({ write, demoAddress: '0xdemo', walletsFile: '~/.keys' });

describe('runSeed', () => {
  it('writes nothing in a dry run, and says so', async () => {
    const world = fakeWorld();
    const lines = [];

    await runSeed({ ...world, config: seedConfig(false), log: (line) => lines.push(line) });

    expect(world.chain.funded).toEqual([]);
    expect(world.chain.calls).toEqual([]);
    expect(world.chain.kudos).toEqual([]);
    expect(lines[0]).toContain('DRY RUN');
  });

  it('funds, registers, fills in and wires up every athlete', async () => {
    const world = fakeWorld();

    await runSeed({ ...world, config: seedConfig(true), log: () => {} });

    const { chain } = world;
    expect(chain.funded).toHaveLength(DEMO_ATHLETES.length);
    expect(chain.registered.size).toBe(DEMO_ATHLETES.length);
    for (const { athlete, address } of world.accounts) {
      expect(chain.activities.get(address)).toBe(athlete.activities.length);
      // Each athlete follows your wallet and every other athlete.
      expect(chain.follows.get(address)).toHaveLength(DEMO_ATHLETES.length);
      expect(chain.follows.get(address)).toContain('0xdemo');
    }
    expect(chain.metadata.map((m) => m.name)).toContain('Morning 5K');
    expect(chain.kudos.length).toBeGreaterThan(0);
  });

  it('registers an athlete before recording their first activity', async () => {
    const world = fakeWorld();

    await runSeed({ ...world, config: seedConfig(true), log: () => {} });

    const calls = world.chain.calls;
    expect(calls.indexOf('register:0xa0')).toBeLessThan(calls.indexOf('record:0xa0'));
  });

  it('changes nothing the second time, so re-running is safe', async () => {
    const world = fakeWorld();
    await runSeed({ ...world, config: seedConfig(true), log: () => {} });
    const after = {
      funded: world.chain.funded.length,
      kudos: world.chain.kudos.length,
      calls: world.chain.calls.length,
      follows: [...world.chain.follows.values()].flat().length,
    };

    await runSeed({ ...world, config: seedConfig(true), log: () => {} });

    expect(world.chain.funded).toHaveLength(after.funded);
    expect(world.chain.kudos).toHaveLength(after.kudos);
    expect(world.chain.calls).toHaveLength(after.calls);
    expect([...world.chain.follows.values()].flat()).toHaveLength(after.follows);
  });

  it('stops rather than carry on when a transaction is not confirmed', async () => {
    const world = fakeWorld({ failRecord: true });

    await expect(runSeed({ ...world, config: seedConfig(true), log: () => {} })).rejects.toThrow(
      /not confirmed/
    );
    expect(world.chain.metadata).toEqual([]);
  });
});
