import { findRecordedActivity, findRecordedActivityInSubgraph } from './activityProof.js';
import { getRelayChainConfig } from './chainConfig.js';
import { logError } from './logError.js';
import { RetryLaterError } from './relayErrors.js';
import { getRelayerPublicClient } from './relayer.js';

/** Who recorded `activityHash` and how far: the subgraph first, the chain's logs if it can't say. */
export async function lookupRecordedActivity(activityHash: `0x${string}`) {
  const { contracts, deployBlock, subgraphUrl } = getRelayChainConfig();
  if (subgraphUrl) {
    const indexed = await findRecordedActivityInSubgraph(subgraphUrl, activityHash).catch(
      (error) => {
        logError('[relay] Subgraph lookup failed, scanning logs instead', error);
        return null;
      }
    );
    if (indexed) return indexed;
  }
  try {
    return await findRecordedActivity(
      getRelayerPublicClient(),
      contracts.activityRegistry as `0x${string}`,
      activityHash,
      deployBlock
    );
  } catch (error) {
    // Public RPCs refuse or prune old log ranges at random: worth a retry, not a hard failure.
    throw new RetryLaterError(error);
  }
}
