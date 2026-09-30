import { describe, expect, it, vi } from 'vitest';
import { settlementVerdict } from '../challengeSettlement.js';
import type { ChainIndex, IndexedActivity, IndexedChallenge } from '../index/types.js';

const CHALLENGER = '0x00000000000000000000000000000000000000aa';
const OPPONENT = '0x00000000000000000000000000000000000000bb';
const CREATED = 1_000;
const DEADLINE = 2_000;

function fakeIndex(options: {
  challenge?: Partial<IndexedChallenge> | null;
  headTimestamp?: number;
  activities?: IndexedActivity[];
}): ChainIndex {
  const { challenge = {}, headTimestamp = DEADLINE + 60, activities = [] } = options;
  return {
    headTimestamp: async () => headTimestamp,
    challenge: async () =>
      challenge === null
        ? null
        : {
            status: 'Accepted',
            activityType: 0,
            deadline: DEADLINE,
            createdAt: CREATED,
            challenger: CHALLENGER,
            opponent: OPPONENT,
            ...challenge,
          },
    // The real index filters by window; the verdict also guards the window itself, so hand it everything.
    activities: async (user) => activities.filter((a) => a.user === user),
    activeTerritoryArea: async () => 0,
  };
}

const run = (
  user: string,
  distance: number,
  timestamp = 1_500,
  activityType = 0
): IndexedActivity => ({
  user: user as `0x${string}`,
  activityHash: `0x${'ab'.repeat(32)}`,
  activityType,
  distance,
  duration: 600,
  timestamp,
});

const verdict = (index: ChainIndex, now = DEADLINE + 100) => settlementVerdict(index, 7n, now);

describe('settlementVerdict', () => {
  it('names whoever ran further inside the challenge window and sport', async () => {
    const index = fakeIndex({
      activities: [
        run(CHALLENGER, 3_000),
        run(OPPONENT, 2_000),
        run(OPPONENT, 2_000),
        // Outside the window, or another sport: neither counts.
        run(CHALLENGER, 50_000, CREATED - 1),
        run(CHALLENGER, 50_000, DEADLINE + 1),
        run(CHALLENGER, 50_000, 1_500, 1),
      ],
    });

    expect(await verdict(index)).toEqual({ kind: 'winner', winner: OPPONENT });
  });

  it('asks the index only for the challenge window, once per athlete', async () => {
    const index = fakeIndex({});
    const activities = vi.spyOn(index, 'activities');

    await verdict(index);

    expect(activities).toHaveBeenCalledWith(CHALLENGER, { from: CREATED, to: DEADLINE });
    expect(activities).toHaveBeenCalledWith(OPPONENT, { from: CREATED, to: DEADLINE });
  });

  it('calls a dead heat a tie, with nobody to pay', async () => {
    const index = fakeIndex({ activities: [run(CHALLENGER, 1_000), run(OPPONENT, 1_000)] });

    expect(await verdict(index)).toEqual({ kind: 'tie' });
  });

  it('counts every sport when the challenge names one we do not know', async () => {
    const index = fakeIndex({
      challenge: { activityType: 99 },
      activities: [run(CHALLENGER, 500, 1_500, 4), run(OPPONENT, 100, 1_500, 0)],
    });

    expect(await verdict(index)).toEqual({ kind: 'winner', winner: CHALLENGER });
  });

  it('does not settle before the deadline', async () => {
    const index = fakeIndex({ headTimestamp: DEADLINE - 1 });

    expect(await verdict(index, DEADLINE - 1)).toEqual({ kind: 'not_ended' });
  });

  it('judges by block time, which is the clock the contract uses, not by the server clock', async () => {
    // The chain's clock is past the deadline (a time jump on a dev chain) while the server's is not.
    const index = fakeIndex({ headTimestamp: DEADLINE + 60, activities: [run(CHALLENGER, 1_000)] });

    expect(await verdict(index, DEADLINE - 500)).toEqual({ kind: 'winner', winner: CHALLENGER });
  });

  it('waits while the record has not reached the deadline though the clock has, so a last run is not missed', async () => {
    const index = fakeIndex({ headTimestamp: DEADLINE - 5, activities: [run(CHALLENGER, 9_000)] });

    expect(await verdict(index, DEADLINE + 100)).toEqual({ kind: 'not_indexed' });
  });

  it('refuses a challenge that is not live', async () => {
    expect(await verdict(fakeIndex({ challenge: { status: 'Settled' } }))).toEqual({
      kind: 'not_active',
    });
  });

  it('reports a challenge the chain does not know', async () => {
    expect(await verdict(fakeIndex({ challenge: null }))).toEqual({ kind: 'not_found' });
  });

  it('fails loudly when the record cannot be read, so the caller can retry', async () => {
    const down: ChainIndex = {
      ...fakeIndex({}),
      challenge: async () => {
        throw new Error('rpc down');
      },
    };

    await expect(verdict(down)).rejects.toThrow(/rpc down/);
  });
});
