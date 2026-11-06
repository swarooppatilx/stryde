import { type ChainMode, DEFAULT_CHAIN_MODE } from '@repo/shared';
import { Platform } from 'react-native';
import { activeChainMode } from '@/backends/activeProfile';
import type { WorldIdEnvironment } from '@/types/worldId';

export const ENV: {
  readonly APP_NAME: string;
  readonly APP_ENV: string;
  readonly PRIVY_APP_ID: string;
  readonly PRIVY_CLIENT_ID: string;
  readonly SUBGRAPH_URL: string;
  API_URL: string;
  readonly API_CONFIGURED: boolean;
  readonly API_KEY: string;
  readonly CHAIN_MODE: ChainMode;
  readonly USE_SMART_WALLET: boolean;
  readonly WORLD_APP_ID: string;
  readonly WORLD_RP_ID: string;
  readonly WORLD_ENVIRONMENT: WorldIdEnvironment;
  readonly MAPBOX_ACCESS_TOKEN: string;
  readonly WEB_URL: string;
} = {
  APP_NAME: process.env.EXPO_PUBLIC_APP_NAME || 'Stryde',
  APP_ENV: process.env.EXPO_PUBLIC_APP_ENV || 'development',
  PRIVY_APP_ID: process.env.EXPO_PUBLIC_PRIVY_APP_ID || '',
  PRIVY_CLIENT_ID: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || '',
  SUBGRAPH_URL: process.env.EXPO_PUBLIC_SUBGRAPH_URL || '',
  // Android emulators cannot reach the host through localhost. Physical devices should set
  // EXPO_PUBLIC_API_URL to the machine's LAN address (or use adb reverse for port 3000).
  API_URL:
    process.env.EXPO_PUBLIC_API_URL ||
    (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://127.0.0.1:3000'),
  // The URL above falls back to localhost, so this says whether the app was pointed at a real API.
  API_CONFIGURED: Boolean(process.env.EXPO_PUBLIC_API_URL),
  API_KEY: process.env.EXPO_PUBLIC_API_KEY || '',
  CHAIN_MODE: (process.env.EXPO_PUBLIC_CHAIN_MODE || DEFAULT_CHAIN_MODE) as ChainMode,
  // Privy smart account (gasless, paymaster-sponsored) for on-chain writes. Remote modes only: local Anvil has no ERC-4337 infra. Set to 'false' to use the raw embedded wallet.
  USE_SMART_WALLET: process.env.EXPO_PUBLIC_USE_SMART_WALLET !== 'false',
  WORLD_APP_ID: process.env.EXPO_PUBLIC_WORLD_APP_ID || '',
  WORLD_RP_ID: process.env.EXPO_PUBLIC_WORLD_RP_ID || '',
  WORLD_ENVIRONMENT: (process.env.EXPO_PUBLIC_WORLD_ENVIRONMENT || 'sandbox') as WorldIdEnvironment,
  // Public (pk.) token for the Mapbox maps SDK; without it the map shows its offline fallback.
  MAPBOX_ACCESS_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '',
  // The website that hosts Support, Terms and Privacy; the About rows show only when it is set.
  WEB_URL: process.env.EXPO_PUBLIC_WEB_URL || '',
};

let resolvedLocalRpcUrl: string | null = null;

export function setDevHost(host: string): void {
  ENV.API_URL = `http://${host}:3000`;
  resolvedLocalRpcUrl = `http://${host}:8545`;
}

export function getLocalRpcUrl(): string {
  if (resolvedLocalRpcUrl) return resolvedLocalRpcUrl;
  const configured = process.env.EXPO_PUBLIC_RPC_URL;
  if (configured && !configured.includes('sepolia')) return configured;
  if (Platform.OS === 'android') return 'http://10.0.2.2:8545';
  return 'http://127.0.0.1:8545';
}

export const DEFAULT_CENTER: [number, number] = [73.851074, 18.524209];

// Separate file so stores can import it without pulling in react-native, which keeps them testable.
export { clearCurrentUserId, getCurrentUserId, setCurrentUserId } from './currentUser';

export const getChainMode = (): ChainMode => activeChainMode(ENV.CHAIN_MODE);
