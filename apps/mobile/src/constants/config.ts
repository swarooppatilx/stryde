import { type ChainMode, DEFAULT_CHAIN_MODE } from '@repo/shared';
import { Platform } from 'react-native';
import { activeChainMode } from '@/backends/activeProfile';
import type { WorldIdEnvironment } from '@/types/worldId';

export const ENV = {
  APP_NAME: process.env.EXPO_PUBLIC_APP_NAME || 'Stryde',
  APP_ENV: process.env.EXPO_PUBLIC_APP_ENV || 'development',
  PRIVY_APP_ID: process.env.EXPO_PUBLIC_PRIVY_APP_ID || '',
  PRIVY_CLIENT_ID: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || '',
  SUBGRAPH_URL: process.env.EXPO_PUBLIC_SUBGRAPH_URL || '',
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  API_KEY: process.env.EXPO_PUBLIC_API_KEY || '',
  CHAIN_MODE: (process.env.EXPO_PUBLIC_CHAIN_MODE || DEFAULT_CHAIN_MODE) as ChainMode,
  // Privy smart account (gasless, paymaster-sponsored) for on-chain writes. Remote modes only: local Anvil has no ERC-4337 infra. Set to 'false' to use the raw embedded wallet.
  USE_SMART_WALLET: process.env.EXPO_PUBLIC_USE_SMART_WALLET !== 'false',
  WORLD_APP_ID: process.env.EXPO_PUBLIC_WORLD_APP_ID || '',
  WORLD_RP_ID: process.env.EXPO_PUBLIC_WORLD_RP_ID || '',
  WORLD_ENVIRONMENT: (process.env.EXPO_PUBLIC_WORLD_ENVIRONMENT || 'sandbox') as WorldIdEnvironment,
} as const;

export function getLocalRpcUrl(): string {
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_RPC_URL || 'http://10.0.0.2:8545';
  return 'http://127.0.0.1:8545';
}

export const DEFAULT_CENTER: [number, number] = [73.851074, 18.524209];

// Separate file so stores can import it without pulling in react-native, which keeps them testable.
export { clearCurrentUserId, getCurrentUserId, setCurrentUserId } from './currentUser';

export const getChainMode = (): ChainMode => activeChainMode(ENV.CHAIN_MODE);
