import { parseAbi, zeroAddress } from 'viem';
import { toAddress } from './address.js';
import {
  arkivConfigFromEnv,
  arkivSignerFromEnv,
  createArkivPublicClient,
  createArkivWalletClient,
} from './arkiv.js';
import { createArkivNotifyCheckpoint } from './arkivNotifyCheckpointStore.js';
import { getRelayChainConfig } from './chainConfig.js';
import type { NotifyDeps, WatchedLog } from './eventNotifier.js';
import { getPush } from './pushRuntime.js';
import { ConfigError } from './relayErrors.js';
import { getRelayerPublicClient } from './relayer.js';

const SOCIAL_EVENTS = parseAbi([
  'event KudosGiven(uint256 indexed activityId, address indexed giver, uint256 timestamp)',
  'event CommentAdded(uint256 indexed activityId, address indexed author, bytes32 indexed commentId, string commentCid, uint256 timestamp)',
]);
const CHALLENGE_EVENTS = parseAbi([
  'event ChallengeCreated(uint256 indexed challengeId, address indexed challenger, address indexed opponent, uint8 activityType, uint256 targetMetric, uint256 deadline, uint256 stake)',
]);
const ACTIVITY_OWNER = parseAbi([
  'function getActivityOwner(uint256 activityId) view returns (address)',
]);

/** The notifier wired to the configured chain, the Arkiv checkpoint and the push sender. */
export function buildNotifyDeps(): NotifyDeps {
  const { contracts } = getRelayChainConfig();
  const { socialRegistry, challengeRegistry, activityRegistry } = contracts;
  if (!socialRegistry || !challengeRegistry || !activityRegistry)
    throw new ConfigError('contract addresses');
  const client = getRelayerPublicClient();
  const arkiv = arkivConfigFromEnv();

  return {
    head: () => client.getBlockNumber({ cacheTime: 0 }),
    async getLogs({ fromBlock, toBlock }) {
      const [social, challenges] = await Promise.all([
        client.getLogs({
          address: socialRegistry,
          events: SOCIAL_EVENTS,
          fromBlock,
          toBlock,
          strict: true,
        }),
        client.getLogs({
          address: challengeRegistry,
          events: CHALLENGE_EVENTS,
          fromBlock,
          toBlock,
          strict: true,
        }),
      ]);
      return [...social, ...challenges].flatMap((log) =>
        log.transactionHash && log.logIndex !== null && log.blockNumber !== null
          ? [log as unknown as WatchedLog]
          : []
      );
    },
    async resolveRecipient(activityId) {
      const owner = await client.readContract({
        address: activityRegistry,
        abi: ACTIVITY_OWNER,
        functionName: 'getActivityOwner',
        args: [activityId],
      });
      return owner === zeroAddress ? null : toAddress(owner);
    },
    notify: (recipient, message) => getPush().sender.notify(recipient, message),
    checkpoint: createArkivNotifyCheckpoint(
      createArkivPublicClient(arkiv),
      createArkivWalletClient(arkivSignerFromEnv(), arkiv)
    ),
  };
}
