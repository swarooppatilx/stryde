import type { ChainMode } from '@repo/shared';

export type ProfileId = 'live' | 'local' | 'sandbox';

export interface Profile {
  id: ProfileId;
  label: string;
  description: string;
  chainMode: ChainMode;
  /** `privy` is the real login; `dev` lets a developer pick a seeded persona instead. */
  auth: 'privy' | 'dev';
  /** Answer the app's own API calls (IPFS, relay, social, World ID) on the device. */
  fakeApi: boolean;
  /** Keep chain state on the device instead of talking to a node. */
  fakeChain: boolean;
  /** False while the backends it needs are not built yet; it cannot be selected. */
  available: boolean;
}

export const PROFILES: Record<ProfileId, Profile> = {
  live: {
    id: 'live',
    label: 'Live',
    description:
      'Sepolia and the real API, with Privy login. What a build opens on unless it is made for the sandbox.',
    chainMode: 'ethereum-sepolia',
    auth: 'privy',
    fakeApi: false,
    fakeChain: false,
    available: true,
  },
  local: {
    id: 'local',
    label: 'Local',
    description: 'A local anvil chain and local API on your computer. Needs the dev stack running.',
    chainMode: 'local',
    auth: 'dev',
    fakeApi: false,
    fakeChain: false,
    available: true,
  },
  sandbox: {
    id: 'sandbox',
    label: 'Sandbox',
    description: 'Everything on this device, no network: fake chain, API and login.',
    chainMode: 'local',
    auth: 'dev',
    fakeApi: true,
    fakeChain: true,
    available: true,
  },
};

export const DEFAULT_PROFILE: ProfileId = 'live';

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === 'string' && Object.hasOwn(PROFILES, value);
}

/**
 * The profile to boot with. Only development builds honour a stored choice, and only an available
 * one: anywhere else the answer is `live`, so a leftover or tampered setting cannot switch a release build to fakes.
 */
export function resolveProfile({
  stored,
  devToolsEnabled,
  fallback = DEFAULT_PROFILE,
}: {
  stored: unknown;
  devToolsEnabled: boolean;
  /** Where a build with developer tools opens when nothing usable is stored. */
  fallback?: ProfileId;
}): ProfileId {
  if (!devToolsEnabled) return DEFAULT_PROFILE;
  return isProfileId(stored) && PROFILES[stored].available ? stored : fallback;
}
