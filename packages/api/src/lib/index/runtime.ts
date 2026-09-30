import { getRelayChainConfig } from '../chainConfig.js';
import { ConfigError } from '../relayErrors.js';
import { getRelayerPublicClient } from '../relayer.js';
import { createChainIndex, type IndexClient } from './chainIndex.js';
import type { ChainIndex } from './types.js';

let cached: ChainIndex | null = null;

/** The onchain record, read from the chain this API relays to. Built on first use, so a missing setting fails only the routes that need it. */
export function getChainIndex(): ChainIndex {
  if (cached) return cached;
  const { contracts, deployBlock } = getRelayChainConfig();
  const { activityRegistry, challengeRegistry, territoryRegistry } = contracts;
  if (!activityRegistry || !challengeRegistry || !territoryRegistry) {
    throw new ConfigError('contract addresses for this chain');
  }
  cached = createChainIndex(
    getRelayerPublicClient() as unknown as IndexClient,
    { activityRegistry, challengeRegistry, territoryRegistry },
    deployBlock
  );
  return cached;
}
