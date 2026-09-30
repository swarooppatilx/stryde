export type Address = `0x${string}`;

export type ChallengeStatusName = 'Open' | 'Accepted' | 'Settled' | 'Cancelled';

export interface IndexedActivity {
  user: Address;
  activityHash: `0x${string}`;
  /** Onchain sport id: 0 (run) to 11 (row). */
  activityType: number;
  /** Metres. */
  distance: number;
  /** Seconds. */
  duration: number;
  /** Block timestamp, epoch seconds. */
  timestamp: number;
}

export interface IndexedChallenge {
  status: ChallengeStatusName;
  activityType: number;
  /** Epoch seconds. */
  deadline: number;
  /** Epoch seconds: the timestamp of the block that created it. */
  createdAt: number;
  challenger: Address;
  opponent: Address;
}

/**
 * What the API needs to know about the onchain record to judge a challenge or a badge. Two
 * implementations answer it the same way: one reads the chain directly, one reads the Arkiv mirror.
 */
export interface ChainIndex {
  /** Timestamp of the newest block the answers include: a verdict is only fair once this is past the deadline. */
  headTimestamp(): Promise<number>;
  challenge(id: bigint): Promise<IndexedChallenge | null>;
  /** One athlete's recorded activities, optionally only those between `from` and `to` (epoch seconds, inclusive). */
  activities(user: Address, window?: { from: number; to: number }): Promise<IndexedActivity[]>;
  /** Square metres of ground the athlete currently holds. */
  activeTerritoryArea(user: Address): Promise<number>;
}
