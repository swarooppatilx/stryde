import type { Context } from 'hono';
import { Hono } from 'hono';
import { checkAchievement } from '../lib/achievementCheck.js';
import { findRecordedActivity, findRecordedActivityInSubgraph } from '../lib/activityProof.js';
import { isAddress } from '../lib/address.js';
import { getRelayChainConfig } from '../lib/chainConfig.js';
import { settlementVerdict } from '../lib/challengeSettlement.js';
import { getContributionLedger } from '../lib/contributionLedgerFromEnv.js';
import { isBytes32 } from '../lib/hex.js';
import { getChainIndex } from '../lib/index/runtime.js';
import { logError } from '../lib/logError.js';
import { RELAY_ABIS } from '../lib/relayAbis.js';
import { classifyRelayError, ReceiptTimeoutError, RetryLaterError } from '../lib/relayErrors.js';
import { getRelayerPublicClient } from '../lib/relayer.js';
import { type RelayResult, relayTx } from '../lib/relayerTx.js';
import { createSerialQueue } from '../lib/serialQueue.js';
import { apiKeyGate } from '../middleware/apiKey.js';
import { invalidJsonBody, limitBody, readJsonObject } from '../middleware/jsonBody.js';

/** Contributions and rewards are meters of distance; nobody covers more than 1000 km in one activity. */
const MAX_DISTANCE_METERS = 1_000_000;
const MAX_SEASON_SECONDS = 366 * 24 * 60 * 60;

/** A whole number of `unit`s within [min, max], or null. */
function wholeNumber(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number') return null;
  const n = Math.round(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

const MAX_RELAY_BODY_BYTES = 16 * 1024;

export const relay = new Hono();
const countContribution = createSerialQueue();
relay.use('*', apiKeyGate);
// Every relay request is a few small fields; anything bigger is not one.
relay.use('*', limitBody(MAX_RELAY_BODY_BYTES));

function mapRelayError(c: Context, error: unknown) {
  // The 503 hides why we lost track of the transaction, so keep the reason in the logs.
  if (error instanceof ReceiptTimeoutError && error.cause) {
    logError('[relay] Transaction sent but not confirmed:', error.cause);
  }
  const failure = classifyRelayError(error);
  if (failure) return c.json({ error: failure.message }, failure.status);
  logError('[relay] Unmapped error:', error);
  return c.json({ error: 'Relay transaction failed' }, 400);
}

async function respondWith(c: Context, write: () => Promise<RelayResult>) {
  try {
    return c.json(await write());
  } catch (error) {
    return mapRelayError(c, error);
  }
}

/** Defining once per achievement type, not before every mint, halves the relayer's gas per badge. */
async function isAchievementDefined(achievementId: `0x${string}`): Promise<boolean> {
  const { exists } = (await getRelayerPublicClient().readContract({
    address: getRelayChainConfig().contracts.achievementRegistry as `0x${string}`,
    abi: RELAY_ABIS.achievementRegistry,
    functionName: 'getAchievement',
    args: [achievementId],
  })) as { exists: boolean };
  return exists;
}

/** Who recorded `activityHash` and how far: the subgraph first, the chain's logs if it can't say. */
async function lookupRecordedActivity(activityHash: `0x${string}`) {
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

relay.post('/mint-achievement', async (c) => {
  const body = await readJsonObject(c);
  if (!body) return invalidJsonBody(c);
  const { recipient, achievementId, achievementName } = body;
  if (
    !isAddress(recipient) ||
    !isBytes32(achievementId) ||
    typeof achievementName !== 'string' ||
    !achievementName.trim()
  ) {
    return c.json(
      { error: 'Required: recipient (address), achievementId (bytes32), achievementName (text)' },
      400
    );
  }

  // Badges are earned from the athlete's onchain record, not from what the app says.
  let verdict: Awaited<ReturnType<typeof checkAchievement>>;
  try {
    verdict = await checkAchievement(getChainIndex(), recipient, achievementId);
  } catch (error) {
    return mapRelayError(c, new RetryLaterError(error));
  }
  if (!verdict.ok) {
    return verdict.reason === 'unknown'
      ? c.json({ error: 'Unknown achievement' }, 400)
      : c.json({ error: 'This achievement is not earned yet' }, 403);
  }
  const name = verdict.name;

  return respondWith(c, async () => {
    if (!(await isAchievementDefined(achievementId))) {
      await relayTx({
        contract: 'achievementRegistry',
        functionName: 'defineAchievement',
        args: [achievementId, name],
      });
    }
    return relayTx({
      contract: 'achievementRegistry',
      functionName: 'mintAchievement',
      args: [recipient, achievementId],
    });
  });
});

relay.post('/mint-reward', async (c) => {
  const body = await readJsonObject(c);
  if (!body) return invalidJsonBody(c);
  const { recipient, activityHash, distance } = body;
  const meters = wholeNumber(distance, 1, MAX_DISTANCE_METERS);
  if (!isAddress(recipient) || !isBytes32(activityHash) || meters === null) {
    return c.json(
      {
        error: `Required: recipient (address), activityHash (bytes32), distance (1 to ${MAX_DISTANCE_METERS} meters)`,
      },
      400
    );
  }

  // The reward is for an activity the recipient recorded themselves, at the distance they
  // recorded: without this check the shared API key could mint STRD to anyone.
  let recorded: Awaited<ReturnType<typeof lookupRecordedActivity>>;
  try {
    recorded = await lookupRecordedActivity(activityHash);
  } catch (error) {
    return mapRelayError(c, error);
  }
  if (!recorded) {
    return c.json({ error: 'Activity is not visible onchain yet; try again shortly' }, 503);
  }
  if (recorded.owner.toLowerCase() !== recipient.toLowerCase()) {
    return c.json({ error: 'Only the athlete who recorded this activity can be rewarded' }, 403);
  }
  const rewardMeters =
    recorded.distance > BigInt(MAX_DISTANCE_METERS)
      ? BigInt(MAX_DISTANCE_METERS)
      : recorded.distance;
  if (rewardMeters === 0n) return c.json({ error: 'The recorded activity has no distance' }, 400);

  return respondWith(c, () =>
    relayTx({
      contract: 'moveToEarnToken',
      functionName: 'mintForActivity',
      args: [recipient, activityHash, rewardMeters],
    })
  );
});

const SETTLEMENT_REFUSALS = {
  tie: { status: 409, error: 'The challenge ended tied, so there is no winner to pay.' },
  not_ended: { status: 409, error: 'This challenge is not over yet.' },
  not_active: { status: 409, error: 'This challenge is not open for settling.' },
  not_found: { status: 404, error: 'Unknown challenge' },
  not_indexed: {
    status: 503,
    error: 'The latest activity is still being indexed; try again shortly',
  },
} as const;

function parseChallengeId(value: unknown): bigint | null {
  if (typeof value === 'string' && /^\d{1,18}$/.test(value)) return BigInt(value);
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  return null;
}

relay.post('/settle-challenge', async (c) => {
  const body = await readJsonObject(c);
  if (!body) return invalidJsonBody(c);
  const { challengeId } = body;
  const id = parseChallengeId(challengeId);
  if (id === null) return c.json({ error: 'Required: challengeId (a whole number)' }, 400);

  // The winner is worked out from the onchain record, never taken from the caller: a named
  // winner is how an athlete would pay themselves both stakes.
  let verdict: Awaited<ReturnType<typeof settlementVerdict>>;
  try {
    verdict = await settlementVerdict(getChainIndex(), id, Math.floor(Date.now() / 1000));
  } catch (error) {
    return mapRelayError(c, new RetryLaterError(error));
  }
  if (verdict.kind !== 'winner') {
    const { status, error } = SETTLEMENT_REFUSALS[verdict.kind];
    return c.json({ error }, status);
  }

  return respondWith(c, () =>
    relayTx({
      contract: 'challengeRegistry',
      functionName: 'settleChallenge',
      args: [id, verdict.winner],
    })
  );
});

relay.post('/mint-territory-nft', async (c) => {
  const body = await readJsonObject(c);
  if (!body) return invalidJsonBody(c);
  const { recipient, polygonHash } = body;
  if (!isAddress(recipient) || !isBytes32(polygonHash)) {
    return c.json({ error: 'Required: recipient (address), polygonHash (bytes32)' }, 400);
  }

  let controller: `0x${string}`;
  try {
    ({ controller } = await getRelayerPublicClient().readContract({
      address: getRelayChainConfig().contracts.territoryRegistry as `0x${string}`,
      abi: RELAY_ABIS.territoryRegistry,
      functionName: 'getTerritory',
      args: [polygonHash],
    }));
  } catch (error) {
    return mapRelayError(c, error);
  }
  if (/^0x0{40}$/.test(controller)) {
    return c.json({ error: 'Territory claim is not visible onchain yet; try again shortly' }, 503);
  }
  if (controller.toLowerCase() !== recipient.toLowerCase()) {
    return c.json({ error: 'Only the athlete who controls this territory can mint it' }, 403);
  }

  return respondWith(c, () =>
    relayTx({
      contract: 'territoryNFT',
      functionName: 'mintTerritory',
      args: [recipient, polygonHash],
    })
  );
});

relay.post('/start-season', async (c) => {
  const body = await readJsonObject(c);
  if (!body) return invalidJsonBody(c);
  const seconds = wholeNumber(body.durationSeconds, 1, MAX_SEASON_SECONDS);
  if (seconds === null) {
    return c.json({ error: `durationSeconds must be between 1 and ${MAX_SEASON_SECONDS}` }, 400);
  }
  return respondWith(c, () =>
    relayTx({ contract: 'seasonManager', functionName: 'startSeason', args: [BigInt(seconds)] })
  );
});

/** Best effort: a claim that cannot be dropped only delays a retry, it never double counts. */
async function releaseClaim(ledger: ReturnType<typeof getContributionLedger>, claim: string) {
  await ledger.release(claim).catch((error) => {
    logError('[relay] Could not release a contribution claim', error);
  });
}

const MARK_ATTEMPTS = 3;
const MARK_BACKOFF_MS = 200;

/** Retries the ledger write: the contribution is already onchain, so losing the mark invites a double count. */
async function markCounted(
  ledger: ReturnType<typeof getContributionLedger>,
  activityHash: `0x${string}`,
  participant: `0x${string}`,
  claim: string
) {
  for (let attempt = 1; attempt <= MARK_ATTEMPTS; attempt++) {
    try {
      await ledger.mark(activityHash, participant, claim);
      return;
    } catch (error) {
      if (attempt === MARK_ATTEMPTS) {
        // The claim is kept, so a replay is still refused.
        logError('[relay] Counted a contribution but could not record it in the ledger', error);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, MARK_BACKOFF_MS * attempt));
    }
  }
}

relay.post('/record-contribution', async (c) => {
  const body = await readJsonObject(c);
  if (!body) return invalidJsonBody(c);
  const { participant, activityHash } = body;
  if (!isAddress(participant) || !isBytes32(activityHash)) {
    return c.json({ error: 'Required: participant (address), activityHash (bytes32)' }, 400);
  }

  const alreadyCounted = () =>
    c.json({ error: 'This activity already counts, or is being counted, for the season' }, 409);
  let ledger: ReturnType<typeof getContributionLedger>;
  let recorded: Awaited<ReturnType<typeof lookupRecordedActivity>>;
  try {
    ledger = getContributionLedger();
    if (await ledger.has(activityHash)) return alreadyCounted();
    recorded = await lookupRecordedActivity(activityHash);
  } catch (error) {
    return mapRelayError(c, error);
  }
  if (!recorded) {
    return c.json({ error: 'Activity is not visible onchain yet; try again shortly' }, 503);
  }
  if (recorded.owner.toLowerCase() !== participant.toLowerCase()) {
    return c.json({ error: 'Only the athlete who recorded this activity can be credited' }, 403);
  }
  const meters =
    recorded.distance > BigInt(MAX_DISTANCE_METERS)
      ? BigInt(MAX_DISTANCE_METERS)
      : recorded.distance;
  if (meters === 0n) return c.json({ error: 'The recorded activity has no distance' }, 400);

  // SeasonManager adds whatever it is sent, so claim the activity before sending. The claim
  // is dropped only when the write definitely did not happen; if it may still mine
  // (unconfirmed), it stays and a replay is answered 409 instead of sending a second time.
  // Only the check-and-reserve runs one at a time per instance (a best-effort guard; separate
  // instances can still race, see ContributionLedger); the send and receipt wait do not.
  let claim: string | null;
  try {
    claim = await countContribution(async () =>
      (await ledger.has(activityHash)) ? null : ledger.reserve(activityHash, participant)
    );
  } catch (error) {
    return mapRelayError(c, error);
  }
  if (claim === null) return alreadyCounted();
  const reserved = claim;

  return respondWith(c, async () => {
    let result: RelayResult;
    try {
      result = await relayTx({
        contract: 'seasonManager',
        functionName: 'recordContribution',
        args: [participant, meters],
      });
    } catch (error) {
      if (!(error instanceof ReceiptTimeoutError)) await releaseClaim(ledger, reserved);
      throw error;
    }
    if (result.confirmed) {
      // The contribution is onchain; reporting failure here would make the app retry and count it twice.
      await markCounted(ledger, activityHash, participant, reserved);
    } else {
      await releaseClaim(ledger, reserved);
    }
    return result;
  });
});
