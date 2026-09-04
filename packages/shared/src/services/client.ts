import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { type ChainMode, DEFAULT_CHAIN_MODE, getChainConfig } from '../constants';
import { ABIS } from '../contracts';

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
    transport: http(config.rpcUrl),
  }) as PublicClient;
}

export function getWalletClient(privateKey: `0x${string}`): WalletClient {
  const config = getChainConfig(currentMode);
  return createWalletClient({
    chain: config.chain,
    account: privateKey,
    transport: http(config.rpcUrl),
  }) as WalletClient;
}

export function getContracts() {
  const config = getChainConfig(currentMode);
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
  } as const;
}
