import {
  arkivConfigFromEnv,
  arkivSignerFromEnv,
  createArkivPublicClient,
  createArkivWalletClient,
} from '../arkiv.js';
import { getRelayChainConfig } from '../chainConfig.js';
import { ConfigError } from '../relayErrors.js';
import { getRelayerPublicClient } from '../relayer.js';
import { type ArkivMirror, createArkivMirrorStore } from './arkivMirror.js';
import { createChainMirrorSource, type MirrorClient } from './chainSource.js';
import { createFreshness } from './freshness.js';
import { type MirrorResult, syncMirror } from './mirror.js';
import type { MirroredContract } from './mirrorEvents.js';
import type { Address } from './types.js';

/** A sync is trusted this long: short enough that a new activity shows up quickly, long enough that a busy screen does not read the chain on every request. */
const FRESH_FOR_MS = 30_000;
const CONTRACTS: MirroredContract[] = [
  'profileRegistry',
  'activityRegistry',
  'seasonManager',
  'achievementRegistry',
  'groupRegistry',
  'territoryRegistry',
];

interface Runtime {
  mirror: ArkivMirror;
  sync(): Promise<MirrorResult>;
  fresh: ReturnType<typeof createFreshness>;
}

let cached: Runtime | null = null;

/** The Arkiv mirror of the onchain record, built on first use so a missing key fails only the routes that need it. */
export function getMirrorRuntime(): Runtime {
  if (cached) return cached;
  const { contracts, deployBlock } = getRelayChainConfig();
  const addresses = {} as Record<MirroredContract, Address>;
  for (const name of CONTRACTS) {
    const address = contracts[name];
    if (!address) throw new ConfigError(`contract address for ${name}`);
    addresses[name] = address;
  }
  const arkiv = arkivConfigFromEnv();
  const mirror = createArkivMirrorStore(
    createArkivPublicClient(arkiv),
    createArkivWalletClient(arkivSignerFromEnv(), arkiv)
  );
  const source = createChainMirrorSource(
    getRelayerPublicClient() as unknown as MirrorClient,
    addresses
  );
  const sync = () => syncMirror(source, mirror, { deployBlock });
  const fresh = createFreshness({
    run: async () => ({ block: (await sync()).to }),
    ttlMs: FRESH_FOR_MS,
  });
  cached = { mirror, sync, fresh };
  return cached;
}
