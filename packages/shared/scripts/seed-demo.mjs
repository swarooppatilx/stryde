/**
 * Seeds a few demo athletes on Sepolia so the feed, leaderboard and follow graph are alive
 * for the demo (runbook SWA-56). DRY RUN unless you pass --yes.
 *
 *   node --env-file=packages/api/.env --import tsx packages/shared/scripts/seed-demo.mjs          # plan only
 *   node --env-file=packages/api/.env --import tsx packages/shared/scripts/seed-demo.mjs --yes    # do it
 *
 * Needs: API_URL (the API that pins to IPFS and stores follows), API_KEY if the API has one,
 * RELAYER_PRIVATE_KEY (pays the demo wallets' gas). Optional: DEMO_ADDRESS (your own wallet: every
 * demo athlete follows it), DEMO_WALLETS_FILE (default ~/.stryde-demo-wallets.json, owner-only; the
 * throwaway keys live there, never in the repo).
 *
 * Safe to re-run: each athlete is funded, registered, filled with activities and wired up only for
 * what is still missing. The athletes are NOT World ID verified: that badge stays honest.
 * Writes are public and permanent on Sepolia.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const EARTH_RADIUS_M = 6_371_000;
const FUND_BELOW_WEI = 5n * 10n ** 15n; // 0.005 ETH
const FUND_AMOUNT_WEI = 10n ** 16n; // 0.01 ETH
const _DAY_MS = 86_400_000;

export const DEMO_ATHLETES = [
  {
    username: 'dhanya_runs',
    center: [73.8939, 18.5362], // Koregaon Park
    activities: [
      { name: 'Morning 5K', type: 'run', km: 5, paceMinPerKm: 5.6, daysAgo: 1 },
      { name: 'Easy recovery run', type: 'run', km: 3.2, paceMinPerKm: 6.4, daysAgo: 3 },
      { name: 'Long Sunday run', type: 'run', km: 10.4, paceMinPerKm: 5.9, daysAgo: 6 },
    ],
  },
  {
    username: 'aadhira_rides',
    center: [73.7868, 18.559], // Baner
    activities: [
      { name: 'Baner hill ride', type: 'ride', km: 22, paceMinPerKm: 2.6, daysAgo: 2 },
      { name: 'Commute loop', type: 'ride', km: 9, paceMinPerKm: 2.9, daysAgo: 4 },
      { name: 'Weekend century warm-up', type: 'ride', km: 41, paceMinPerKm: 2.4, daysAgo: 7 },
    ],
  },
  {
    username: 'meenakshi_hikes',
    center: [73.8077, 18.5074], // Kothrud
    activities: [
      { name: 'Vetal Tekdi trail', type: 'hike', km: 6.5, paceMinPerKm: 11, daysAgo: 2 },
      { name: 'Sunset walk', type: 'walk', km: 4, paceMinPerKm: 10.5, daysAgo: 5 },
      { name: 'Parvati steps', type: 'hike', km: 3.1, paceMinPerKm: 13, daysAgo: 8 },
    ],
  },
  {
    username: 'rakshitha_tempo',
    center: [73.9143, 18.5679], // Viman Nagar
    activities: [
      { name: 'Tempo intervals', type: 'run', km: 7.5, paceMinPerKm: 4.8, daysAgo: 1 },
      { name: 'Track session', type: 'run', km: 6, paceMinPerKm: 4.5, daysAgo: 4 },
      { name: '10K race pace', type: 'run', km: 10.2, paceMinPerKm: 4.7, daysAgo: 9 },
    ],
  },
];

export function haversineMeters([lng1, lat1], [lng2, lat2]) {
  const rad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function routeLength(route) {
  let total = 0;
  for (let i = 1; i < route.length; i++) total += haversineMeters(route[i - 1], route[i]);
  return total;
}

/** A closed loop around `center` whose length is `meters`. `phase` rotates it so routes differ. */
export function loopRoute(center, meters, { points = 72, phase = 0 } = {}) {
  const radius = meters / (2 * Math.PI);
  const [lng0, lat0] = center;
  const metersPerLat = (Math.PI / 180) * EARTH_RADIUS_M;
  const metersPerLng = metersPerLat * Math.cos((lat0 * Math.PI) / 180);
  const route = [];
  for (let i = 0; i < points; i++) {
    const angle = phase + (2 * Math.PI * i) / points;
    route.push([
      lng0 + (radius * Math.cos(angle)) / metersPerLng,
      lat0 + (radius * Math.sin(angle)) / metersPerLat,
    ]);
  }
  route.push(route[0]);
  // A circle's chord polygon is a touch shorter than its circumference; scale to hit the target.
  const scale = meters / routeLength(route);
  return route.map(([lng, lat]) => [lng0 + (lng - lng0) * scale, lat0 + (lat - lat0) * scale]);
}

export function buildActivity(spec, athlete, index) {
  const distance = Math.round(spec.km * 1000);
  const coordinates = loopRoute(athlete.center, distance, {
    phase: index * 1.3 + athlete.username.length,
  });
  return {
    name: spec.name,
    activityType: spec.type,
    distance,
    duration: Math.round(spec.km * spec.paceMinPerKm * 60_000),
    coordinates,
    polyline: coordinates.map(([lng, lat]) => `${lng},${lat}`).join(';'),
    // Part of the activity hash, so two athletes' identical stats never collide.
    metadata: `seed-${athlete.username}-${index}`,
    daysAgo: spec.daysAgo,
  };
}

/** What still needs doing for one athlete, given what is already onchain. Pure. */
export function seedPlan(athlete, state, { demoAddress, others }) {
  const targets = [demoAddress, ...others].filter(Boolean);
  const known = new Set(state.following.map((a) => a.toLowerCase()));
  return {
    fund: state.balanceWei < FUND_BELOW_WEI,
    register: !state.registered,
    activitiesToRecord: Math.max(0, athlete.activities.length - state.activityCount),
    follow: targets.filter((address) => !known.has(address.toLowerCase())),
  };
}

export function parseSeedArgs(argv, env) {
  if (!env.API_URL) throw new Error('Set API_URL to the API that pins to IPFS and stores follows');
  if (!env.RELAYER_PRIVATE_KEY)
    throw new Error("Set RELAYER_PRIVATE_KEY (it pays the demo wallets' gas)");
  return {
    write: argv.includes('--yes'),
    apiUrl: env.API_URL.replace(/\/+$/, ''),
    apiKey: env.API_KEY ?? '',
    relayerKey: env.RELAYER_PRIVATE_KEY,
    demoAddress: env.DEMO_ADDRESS ?? null,
    walletsFile: env.DEMO_WALLETS_FILE ?? join(homedir(), '.stryde-demo-wallets.json'),
  };
}

function loadWallets(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

function saveWallets(file, wallets) {
  writeFileSync(file, JSON.stringify(wallets, null, 2), { mode: 0o600 });
  chmodSync(file, 0o600);
}

/**
 * The seeding itself, over injected services so it can be exercised against fakes.
 * `accounts` are { athlete, privateKey, address } (the latter two null in a dry run).
 */
export async function runSeed({ config, services, accounts, relayer, publicClient, log }) {
  log(
    config.write
      ? 'SEEDING (writes are public and permanent)\n'
      : 'DRY RUN (no writes; pass --yes to seed)\n'
  );
  const recorded = []; // { owner address, activityId } from this run, for kudos

  for (const { athlete, privateKey, address } of accounts) {
    const state = address
      ? {
          registered: await services.profile.isRegistered(address),
          balanceWei: await services.client.getBalance(address),
          activityCount: Number(await services.activity.getActivityCount(address)),
          following: (await services.follows.getFollowing(address)).addresses ?? [],
        }
      : { registered: false, balanceWei: 0n, activityCount: 0, following: [] };
    const plan = seedPlan(athlete, state, {
      demoAddress: config.demoAddress,
      // Before the wallets exist (dry run) the username stands in, so the counts are still right.
      others: accounts
        .filter((a) => a.athlete !== athlete)
        .map((a) => a.address ?? a.athlete.username),
    });
    log(
      `${athlete.username.padEnd(14)} ${address ?? '(wallet created on --yes)'}\n` +
        `  fund ${plan.fund ? 'yes' : 'no'} | register ${plan.register ? 'yes' : 'no'} | ` +
        `activities +${plan.activitiesToRecord} | follows +${plan.follow.length}`
    );
    if (!config.write) continue;

    const wallet = services.client.getWalletClient(privateKey);
    if (plan.fund) {
      const hash = await relayer.sendTransaction({ to: address, value: FUND_AMOUNT_WEI });
      await publicClient.waitForTransactionReceipt({ hash });
      log('  funded 0.01 ETH');
    }
    if (plan.register) {
      const result = await services.profile.register(wallet, athlete.username);
      log(`  registered (profile ${result.profileId})`);
    }
    const first = athlete.activities.length - plan.activitiesToRecord;
    for (let i = first; i < athlete.activities.length; i++) {
      const activity = buildActivity(athlete.activities[i], athlete, i);
      const result = await services.activity.recordActivity(wallet, {
        polyline: activity.polyline,
        activityType: activity.activityType,
        distance: activity.distance,
        duration: activity.duration,
        territoryArea: 0,
        metadata: activity.metadata,
      });
      if (!result.confirmed)
        throw new Error(`recordActivity not confirmed for ${athlete.username}`);
      await services.activity.uploadAndSetActivityMetadata(wallet, result.activityId, {
        name: activity.name,
        polyline: activity.polyline,
        coordinates: activity.coordinates,
      });
      recorded.push({ owner: address, activityId: result.activityId });
      log(`  recorded "${activity.name}" (${result.activityId})`);
    }
    for (const followee of plan.follow) {
      await services.follows.setFollowing(wallet, followee, true);
      log(`  follows ${followee}`);
    }
  }

  // Kudos on the activities recorded just now (a rerun records none, so it never toggles one off).
  if (config.write) {
    for (const { address, privateKey } of accounts) {
      const wallet = services.client.getWalletClient(privateKey);
      for (const { activityId } of recorded.filter((r) => r.owner !== address).slice(0, 3)) {
        await services.social.toggleKudos(wallet, activityId);
        log(`  ${address.slice(0, 8)} gave kudos to activity ${activityId}`);
      }
    }
    log(`\nDone. Wallet keys: ${config.walletsFile} (owner-only, outside the repo).`);
  }
}

async function main() {
  const config = parseSeedArgs(process.argv.slice(2), process.env);
  const { services, setIpfsConfig } = await import('../src/index.ts');
  const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts');

  services.client.setChainMode('ethereum-sepolia');
  setIpfsConfig({ apiUrl: config.apiUrl, apiKey: config.apiKey });

  const keys = loadWallets(config.walletsFile);
  const accounts = DEMO_ATHLETES.map((athlete) => {
    const privateKey = keys[athlete.username] ?? (config.write ? generatePrivateKey() : null);
    if (!keys[athlete.username] && privateKey) keys[athlete.username] = privateKey;
    return {
      athlete,
      privateKey,
      address: privateKey ? privateKeyToAccount(privateKey).address : null,
    };
  });
  if (config.write) saveWallets(config.walletsFile, keys);
  const relayer = services.client.getWalletClient(config.relayerKey);
  const publicClient = services.client.getPublicClient();
  await runSeed({ config, services, accounts, relayer, publicClient, log: console.log });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
