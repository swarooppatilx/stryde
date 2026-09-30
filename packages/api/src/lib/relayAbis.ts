/** Errors every relayed contract can revert with: viem names a revert only if its ABI declares it. */
const ACCESS_ERRORS = [
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [{ name: 'account', type: 'address' }],
  },
  {
    type: 'error',
    name: 'AccessControlUnauthorizedAccount',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'neededRole', type: 'bytes32' },
    ],
  },
  { type: 'error', name: 'EnforcedPause', inputs: [] },
  { type: 'error', name: 'ZeroAddress', inputs: [] },
] as const;

export const achievementRegistryAbi = [
  {
    type: 'function',
    name: 'getAchievement',
    inputs: [{ name: 'achievementId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'defineAchievement',
    inputs: [
      { name: 'achievementId', type: 'bytes32' },
      { name: 'name', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'mintAchievement',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'achievementId', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  { type: 'error', name: 'AlreadyMinted', inputs: [] },
  { type: 'error', name: 'EmptyAchievement', inputs: [] },
  ...ACCESS_ERRORS,
] as const;

export const moveToEarnTokenAbi = [
  {
    type: 'function',
    name: 'mintForActivity',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'activityHash', type: 'bytes32' },
      { name: 'distance', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  { type: 'error', name: 'DuplicateActivityHash', inputs: [] },
  { type: 'error', name: 'ZeroDistance', inputs: [] },
  { type: 'error', name: 'EmptyActivityHash', inputs: [] },
  ...ACCESS_ERRORS,
] as const;

export const territoryNFTAbi = [
  {
    type: 'function',
    name: 'mintTerritory',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'polygonHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  { type: 'error', name: 'TerritoryAlreadyMinted', inputs: [] },
  { type: 'error', name: 'EmptyPolygonHash', inputs: [] },
  ...ACCESS_ERRORS,
] as const;

export const seasonManagerAbi = [
  {
    type: 'function',
    name: 'recordContribution',
    inputs: [
      { name: 'participant', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'startSeason',
    inputs: [{ name: 'duration', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getCurrentSeason',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  { type: 'error', name: 'SeasonAlreadyActive' },
  { type: 'error', name: 'SeasonNotActive' },
  { type: 'error', name: 'InvalidDuration' },
  { type: 'error', name: 'NotRecorder', inputs: [] },
  { type: 'error', name: 'InvalidSeason', inputs: [] },
  ...ACCESS_ERRORS,
] as const;

/** Read-only: the relay checks who controls a territory before minting its NFT. */
export const territoryRegistryAbi = [
  {
    type: 'function',
    name: 'getTerritory',
    inputs: [{ name: 'territoryId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'controller', type: 'address' },
          { name: 'capturedAt', type: 'uint256' },
          { name: 'lastReinforced', type: 'uint256' },
          { name: 'controlStrength', type: 'uint256' },
          { name: 'areaSqm', type: 'uint256' },
          { name: 'polygonHash', type: 'bytes32' },
          { name: 'minLng', type: 'int32' },
          { name: 'minLat', type: 'int32' },
          { name: 'maxLng', type: 'int32' },
          { name: 'maxLat', type: 'int32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const;

export const profileRegistryAbi = [
  {
    type: 'function',
    name: 'verify',
    inputs: [
      { name: 'wallet', type: 'address' },
      { name: 'nullifierHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isVerified',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

export const challengeRegistryAbi = [
  {
    type: 'function',
    name: 'settleChallenge',
    inputs: [
      { name: 'challengeId', type: 'uint256' },
      { name: 'winner', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  { type: 'error', name: 'NotSettler', inputs: [] },
  { type: 'error', name: 'NotParticipant', inputs: [] },
  { type: 'error', name: 'NotSettled', inputs: [] },
  { type: 'error', name: 'AlreadySettled', inputs: [] },
  { type: 'error', name: 'DeadlineNotPassed', inputs: [] },
  { type: 'error', name: 'SettleWindowClosed', inputs: [] },
  ...ACCESS_ERRORS,
] as const;

export const RELAY_ABIS = {
  achievementRegistry: achievementRegistryAbi,
  moveToEarnToken: moveToEarnTokenAbi,
  territoryNFT: territoryNFTAbi,
  seasonManager: seasonManagerAbi,
  profileRegistry: profileRegistryAbi,
  territoryRegistry: territoryRegistryAbi,
  challengeRegistry: challengeRegistryAbi,
} as const;
