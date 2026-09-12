export const achievementRegistryAbi = [
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
] as const;

export const seasonManagerAbi = [
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

export const RELAY_ABIS = {
  achievementRegistry: achievementRegistryAbi,
  moveToEarnToken: moveToEarnTokenAbi,
  territoryNFT: territoryNFTAbi,
  seasonManager: seasonManagerAbi,
  profileRegistry: profileRegistryAbi,
} as const;
