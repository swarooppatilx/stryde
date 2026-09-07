import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { type ChainMode, DEFAULT_CHAIN_MODE, getChainConfig } from '../constants';
import { ABIS } from '../contracts';

// A bit more resilience against transient RPC failures (rate limits, brief
// outages) than viem's default 150ms retry delay. Public HTTP RPC endpoints
// occasionally reject/drop requests without warning (see: Ankr's free
// eth_sepolia tier started requiring an API key mid-hackathon).
const rpcTransport = (url: string) =>
  http(url, {
    retryCount: 3,
    retryDelay: 1000,
  });

const warnedZeroAddressModes = new Set<ChainMode>();

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
  return createPublicClient({
    chain: config.chain,
    transport: rpcTransport(config.rpcUrl),
  }) as PublicClient;
}

export function getBalance(address: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  return client.getBalance({ address });
}

export function getWalletClient(privateKey: `0x${string}`): WalletClient {
  const config = getChainConfig(currentMode);
  return createWalletClient({
    chain: config.chain,
    account: privateKeyToAccount(privateKey),
    transport: rpcTransport(config.rpcUrl),
  }) as WalletClient;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function getContracts() {
  const config = getChainConfig(currentMode);

  if (
    !warnedZeroAddressModes.has(currentMode) &&
    Object.values(config.contracts).every((address) => address === ZERO_ADDRESS)
  ) {
    warnedZeroAddressModes.add(currentMode);
    console.warn(
      `[shared/client] All contract addresses for chain mode "${currentMode}" are the zero address — ` +
        "reads will return empty/default data and writes will revert. Contracts likely aren't deployed " +
        'for this mode yet; update packages/shared/src/constants.ts after deploying.'
    );
  }

  return {
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
  } as const;
}
