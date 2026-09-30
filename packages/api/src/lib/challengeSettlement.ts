import type { ChainIndex } from './index/types.js';

/** Onchain activity ids are 0 (run) to 11 (row); `ACTIVITY_TYPE_MAP` in @repo/shared. */
const KNOWN_SPORT_IDS = 12;

export type SettlementVerdict =
  | { kind: 'winner'; winner: `0x${string}` }
  | { kind: 'tie' }
  | { kind: 'not_found' }
  | { kind: 'not_active' }
  | { kind: 'not_ended' }
  | { kind: 'not_indexed' };

/**
 * Who won challenge `challengeId`, judged from the onchain record: the athlete with more distance,
 * in the challenge's sport, between its creation and its deadline. `now` is epoch seconds and only tells
 * a challenge that has not ended from one whose record is lagging.
 * Throws when the record can't be read, so callers can retry.
 */
export async function settlementVerdict(
  index: ChainIndex,
  challengeId: bigint,
  now: number
): Promise<SettlementVerdict> {
  const challenge = await index.challenge(challengeId);
  if (!challenge) return { kind: 'not_found' };
  if (challenge.status !== 'Accepted') return { kind: 'not_active' };

  // The contract judges by block time, so that is the clock here too. If the record has not reached the
  // deadline yet, either it truly has not ended, or a run recorded just before the deadline may be missing
  // from what we can see and judging now could crown the wrong athlete.
  if ((await index.headTimestamp()) <= challenge.deadline) {
    return now <= challenge.deadline ? { kind: 'not_ended' } : { kind: 'not_indexed' };
  }

  const window = { from: challenge.createdAt, to: challenge.deadline };
  const [challengerRuns, opponentRuns] = await Promise.all([
    index.activities(challenge.challenger, window),
    index.activities(challenge.opponent, window),
  ]);

  // A run challenge is not won by cycling. An unknown sport id counts everything.
  const anySport = challenge.activityType >= KNOWN_SPORT_IDS;
  const total = (runs: typeof challengerRuns) =>
    runs
      .filter((r) => r.timestamp >= window.from && r.timestamp <= window.to)
      .filter((r) => anySport || r.activityType === challenge.activityType)
      .reduce((sum, r) => sum + r.distance, 0);

  const challengerTotal = total(challengerRuns);
  const opponentTotal = total(opponentRuns);
  if (challengerTotal === opponentTotal) return { kind: 'tie' };
  return {
    kind: 'winner',
    winner: challengerTotal > opponentTotal ? challenge.challenger : challenge.opponent,
  };
}
