import { parseAbiItem, zeroAddress } from 'viem';
import type { Address } from './types.js';

/** Which contract's logs hold an event, by the key `chainConfig` gives its address. */
export type MirroredContract =
  | 'profileRegistry'
  | 'activityRegistry'
  | 'seasonManager'
  | 'achievementRegistry'
  | 'groupRegistry'
  | 'territoryRegistry';

interface Mirrored {
  contract: MirroredContract;
  abi: ReturnType<typeof parseAbiItem>;
  /** The argument that names the wallet the event is about; none means the zero address. */
  who: string | null;
  /** The argument that names what it is about (an id, a season, a group): the second thing reads filter on. */
  ref: string;
}

/**
 * The events the Arkiv mirror keeps, with the two arguments reads filter on. Mutable things (a
 * profile's latest avatar, who holds a territory, who is in a club) are not stored as state: they are
 * worked out at read time from these events in order, so the mirror only ever appends.
 */
export const MIRRORED: Record<string, Mirrored> = {
  ProfileCreated: {
    contract: 'profileRegistry',
    abi: parseAbiItem(
      'event ProfileCreated(uint256 indexed profileId, address indexed wallet, string username, uint256 joinedAt)'
    ),
    who: 'wallet',
    ref: 'profileId',
  },
  ProfileUpdated: {
    contract: 'profileRegistry',
    abi: parseAbiItem('event ProfileUpdated(uint256 indexed profileId, string username)'),
    who: null,
    ref: 'profileId',
  },
  AvatarUpdated: {
    contract: 'profileRegistry',
    abi: parseAbiItem('event AvatarUpdated(address indexed wallet, string cid)'),
    who: 'wallet',
    ref: 'wallet',
  },
  ProfileVerified: {
    contract: 'profileRegistry',
    abi: parseAbiItem(
      'event ProfileVerified(address indexed wallet, bytes32 nullifierHash, uint256 verifiedAt)'
    ),
    who: 'wallet',
    ref: 'wallet',
  },
  ActivityRecorded: {
    contract: 'activityRegistry',
    abi: parseAbiItem(
      'event ActivityRecorded(uint256 indexed activityId, address indexed owner, bytes32 indexed activityHash, uint8 activityType, uint256 distance, uint256 duration, uint256 timestamp, uint256 territoryArea)'
    ),
    who: 'owner',
    ref: 'activityId',
  },
  ActivityMetadataUpdated: {
    contract: 'activityRegistry',
    abi: parseAbiItem(
      'event ActivityMetadataUpdated(uint256 indexed activityId, address indexed owner, string metadataCid)'
    ),
    who: 'owner',
    ref: 'activityId',
  },
  SeasonStarted: {
    contract: 'seasonManager',
    abi: parseAbiItem(
      'event SeasonStarted(uint256 indexed seasonId, uint256 startTime, uint256 endTime)'
    ),
    who: null,
    ref: 'seasonId',
  },
  SeasonEnded: {
    contract: 'seasonManager',
    abi: parseAbiItem(
      'event SeasonEnded(uint256 indexed seasonId, uint256 endTime, uint256 participantCount)'
    ),
    who: null,
    ref: 'seasonId',
  },
  ContributionRecorded: {
    contract: 'seasonManager',
    abi: parseAbiItem(
      'event ContributionRecorded(uint256 indexed seasonId, address indexed participant, uint256 contribution, uint256 total)'
    ),
    who: 'participant',
    ref: 'seasonId',
  },
  AchievementMinted: {
    contract: 'achievementRegistry',
    abi: parseAbiItem(
      'event AchievementMinted(uint256 indexed tokenId, address indexed recipient, bytes32 indexed achievementId)'
    ),
    who: 'recipient',
    ref: 'achievementId',
  },
  GroupCreated: {
    contract: 'groupRegistry',
    abi: parseAbiItem(
      'event GroupCreated(uint256 indexed groupId, address indexed owner, string name, string location, string description, uint8 sportType, uint256 createdAt)'
    ),
    who: 'owner',
    ref: 'groupId',
  },
  GroupJoined: {
    contract: 'groupRegistry',
    abi: parseAbiItem(
      'event GroupJoined(uint256 indexed groupId, address indexed member, uint256 memberCount)'
    ),
    who: 'member',
    ref: 'groupId',
  },
  GroupLeft: {
    contract: 'groupRegistry',
    abi: parseAbiItem(
      'event GroupLeft(uint256 indexed groupId, address indexed member, uint256 memberCount)'
    ),
    who: 'member',
    ref: 'groupId',
  },
  GroupDissolved: {
    contract: 'groupRegistry',
    abi: parseAbiItem(
      'event GroupDissolved(uint256 indexed groupId, address indexed lastOwner, uint256 dissolvedAt)'
    ),
    who: 'lastOwner',
    ref: 'groupId',
  },
  TerritoryClaimed: {
    contract: 'territoryRegistry',
    abi: parseAbiItem(
      'event TerritoryClaimed(bytes32 indexed territoryId, address indexed controller, uint256 areaSqm, bytes32 polygonHash, int32 minLng, int32 minLat, int32 maxLng, int32 maxLat, uint256 capturedAt, uint256 strength)'
    ),
    who: 'controller',
    ref: 'territoryId',
  },
  TerritoryReinforced: {
    contract: 'territoryRegistry',
    abi: parseAbiItem(
      'event TerritoryReinforced(bytes32 indexed territoryId, address indexed controller, uint256 reinforcedAt, uint256 strength)'
    ),
    who: 'controller',
    ref: 'territoryId',
  },
  TerritoryLost: {
    contract: 'territoryRegistry',
    abi: parseAbiItem(
      'event TerritoryLost(bytes32 indexed territoryId, address indexed oldController, uint256 lostAt)'
    ),
    who: 'oldController',
    ref: 'territoryId',
  },
  TerritoryDecayed: {
    contract: 'territoryRegistry',
    abi: parseAbiItem(
      'event TerritoryDecayed(bytes32 indexed territoryId, uint256 decayedAt, uint256 remainingStrength)'
    ),
    who: null,
    ref: 'territoryId',
  },
};

/** One mirrored event, in the shape stored as an Arkiv entity. */
export interface MirrorEvent {
  kind: string;
  /** Sorts as text in chain order; also what makes a re-read of the same log recognisable. */
  evt: string;
  block: bigint;
  who: Address;
  ref: string;
  /** Every decoded argument, as text (a number can exceed what JSON holds exactly). */
  data: Record<string, string>;
}

/** `block-logIndex`, zero-padded so plain string order is chain order. */
export function evtId(block: bigint, logIndex: number): string {
  return `${block.toString().padStart(13, '0')}-${String(logIndex).padStart(5, '0')}`;
}

/** Normalises one decoded log; null for an event the mirror does not keep. */
export function toMirrorEvent(
  name: string,
  args: Record<string, unknown>,
  block: bigint,
  logIndex: number
): MirrorEvent | null {
  const spec = MIRRORED[name];
  if (!spec) return null;
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) data[key] = String(value);
  const who = spec.who ? String(args[spec.who] ?? zeroAddress).toLowerCase() : zeroAddress;
  return {
    kind: name,
    evt: evtId(block, logIndex),
    block,
    who: who as Address,
    ref: String(args[spec.ref] ?? '-'),
    data,
  };
}
