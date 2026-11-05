import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type PublicClient,
  type WalletClient,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { type ChainMode, DEFAULT_CHAIN_MODE, getChainConfig } from '../constants';
import { ABIS } from '../contracts';

// Retry delays are longer than viem's 150ms default to ride out transient RPC failures; public HTTP RPCs sometimes reject or drop requests without warning.
/** Thrown instead of any network call while the chain is switched off (see `setChainOffline`). */
export class ChainOfflineError extends Error {
  constructor() {
    super('The chain is switched off for this session');
    this.name = 'ChainOfflineError';
  }
}

let chainOffline = false;

/**
 * Switches every chain read and write (and the subgraph) to fail at once with `ChainOfflineError`,
 * instead of waiting on a node that is not there. For a developer profile that runs with no network.
 */
export function setChainOffline(offline: boolean): void {
  chainOffline = offline;
}

export function isChainOffline(): boolean {
  return chainOffline;
}

const rpcTransport = (url: string) =>
  chainOffline
    ? custom(
        {
          request: async () => {
            throw new ChainOfflineError();
          },
        },
        // Nothing to wait for: retrying cannot make a switched-off chain answer.
        { retryCount: 0 }
      )
    : http(url, {
        retryCount: 3,
        retryDelay: 1000,
      });

const warnedZeroAddressModes = new Set<ChainMode>();

// Keyed on mode + rpcUrl (not just mode) so a runtime RPC override — e.g.
// setLocalRpcUrl() picking up a new LAN IP — still invalidates the cache
// instead of serving a client pointed at a stale URL.
let cachedPublicClient: { key: string; client: PublicClient } | null = null;
let cachedWalletClient: { key: string; client: WalletClient } | null = null;
let contractsCache: {
  key: string;
  contracts: {
    [Name in keyof typeof ABIS]: {
      address: `0x${string}`;
      abi: (typeof ABIS)[Name];
    };
  };
} | null = null;

let currentMode: ChainMode = DEFAULT_CHAIN_MODE;

export function setChainMode(mode: ChainMode): void {
  currentMode = mode;
}

export function getChainMode(): ChainMode {
  return currentMode;
}

export function getActiveConfig() {
  return getChainConfig(currentMode);
}

export function getPublicClient(): PublicClient {
  const config = getChainConfig(currentMode);
  const key = `${currentMode}:${config.rpcUrl}:${chainOffline ? 'offline' : 'online'}`;

  if (cachedPublicClient?.key === key) {
    return cachedPublicClient.client;
  }

  const client = createPublicClient({
    chain: config.chain,
    transport: rpcTransport(config.rpcUrl),
    batch: { multicall: true },
  }) as PublicClient;
  cachedPublicClient = { key, client };
  return client;
}

export function getBalance(address: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  return client.getBalance({ address });
}

export function getWalletClient(privateKey: `0x${string}`): WalletClient {
  const config = getChainConfig(currentMode);
  const key = `${currentMode}:${config.rpcUrl}:${chainOffline ? 'offline' : 'online'}:${privateKey}`;

  if (cachedWalletClient?.key === key) {
    return cachedWalletClient.client;
  }

  const client = createWalletClient({
    chain: config.chain,
    account: privateKeyToAccount(privateKey),
    transport: rpcTransport(config.rpcUrl),
  }) as WalletClient;
  cachedWalletClient = { key, client };
  return client;
}

export function getContracts() {
  const config = getChainConfig(currentMode);
  const key = `${currentMode}:${config.rpcUrl}`;

  if (contractsCache?.key === key) {
    return contractsCache.contracts;
  }

  if (
    !warnedZeroAddressModes.has(currentMode) &&
    Object.values(config.contracts).every((address) => address === zeroAddress)
  ) {
    warnedZeroAddressModes.add(currentMode);
    console.warn(
      `[shared/client] All contract addresses for chain mode "${currentMode}" are the zero address — ` +
        "reads will return empty/default data and writes will revert. Contracts likely aren't deployed " +
        'for this mode yet; update packages/shared/src/constants.ts after deploying.'
    );
  }

  const profileRegistryAddress = config.contracts.profileRegistry;

  const contracts = {
    profileRegistry: {
      address: config.contracts.profileRegistry,
      abi: ABIS.profileRegistry,
    },
    activityRegistry: {
      address: config.contracts.activityRegistry,
      abi: ABIS.activityRegistry,
    },
    territoryRegistry: {
      address: config.contracts.territoryRegistry,
      abi: ABIS.territoryRegistry,
    },
    seasonManager: {
      address: config.contracts.seasonManager,
      abi: ABIS.seasonManager,
    },
    achievementRegistry: {
      address: config.contracts.achievementRegistry,
      abi: ABIS.achievementRegistry,
    },
    challengeRegistry: {
      address: config.contracts.challengeRegistry,
      abi: ABIS.challengeRegistry,
    },
    territoryNFT: {
      address: config.contracts.territoryNFT,
      abi: ABIS.territoryNFT,
    },
    moveToEarnToken: {
      address: config.contracts.moveToEarnToken,
      abi: ABIS.moveToEarnToken,
    },
    groupRegistry: {
      address: config.contracts.groupRegistry,
      abi: ABIS.groupRegistry,
    },
    socialRegistry: {
      address: config.contracts.socialRegistry,
      abi: ABIS.socialRegistry,
    },
    eventRegistry: {
      address: config.contracts.eventRegistry,
      abi: ABIS.eventRegistry,
    },
  } as const;

  if (profileRegistryAddress === zeroAddress) {
    throw new Error('Contract addresses not configured — run deploy script first');
  }

  contractsCache = { key, contracts };
  return contracts;
}
