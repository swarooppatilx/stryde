import { type ChainMode, DEFAULT_CHAIN_MODE, getChainConfig } from '@repo/shared';
import { Platform } from 'react-native';

export const ENV = {
  APP_NAME: process.env.EXPO_PUBLIC_APP_NAME || 'Stryde',
  APP_ENV: process.env.EXPO_PUBLIC_APP_ENV || 'development',
  PRIVY_APP_ID: process.env.EXPO_PUBLIC_PRIVY_APP_ID || '',
  PRIVY_CLIENT_ID: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || '',
  SUBGRAPH_URL: process.env.EXPO_PUBLIC_SUBGRAPH_URL || '',
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  MAP_STYLE_URL:
    process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty',
  CHAIN_MODE: (process.env.EXPO_PUBLIC_CHAIN_MODE || DEFAULT_CHAIN_MODE) as ChainMode,
} as const;

export function getLocalRpcUrl(): string {
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_RPC_URL || 'http://10.0.0.2:8545';
  return 'http://127.0.0.1:8545';
}

export function getChainEnv() {
  return getChainConfig(ENV.CHAIN_MODE);
}

export const DEFAULT_CENTER: [number, number] = [73.851074, 18.524209];

export const MAP_STYLES = {
  voyager: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  darkMatter: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
} as const;

let _currentUserId = 'current';

export function setCurrentUserId(id: string): void {
  _currentUserId = id;
}

export function getCurrentUserId(): string {
  return _currentUserId;
}
