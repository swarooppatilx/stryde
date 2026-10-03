import type { ChainMode } from '@repo/shared';
import { DEFAULT_CHAIN_MODE } from '@repo/shared';
import { DEFAULT_PROFILE, PROFILES, type ProfileId } from './profiles';

let active: ProfileId = DEFAULT_PROFILE;

/** The profile this launch runs with. Set once at boot, before anything reads chain state. */
export function setActiveProfileId(id: ProfileId): void {
  active = id;
}

export function getActiveProfileId(): ProfileId {
  return active;
}

/**
 * The chain mode in force. `live` keeps honouring the build's own setting (so a build pointed at a
 * local chain through its env still is); the other profiles carry their own.
 */
export function activeChainMode(buildMode: string | undefined): ChainMode {
  if (active === 'live') return (buildMode || DEFAULT_CHAIN_MODE) as ChainMode;
  return PROFILES[active].chainMode;
}

let pendingBoot: Promise<unknown> | null = null;

/** Marks `boot` as the profile load in progress; `whenProfileReady` waits for it. */
export function trackBoot<T>(boot: Promise<T>): Promise<T> {
  const tracked = boot.finally(() => {
    if (pendingBoot === tracked) pendingBoot = null;
  });
  pendingBoot = tracked;
  return tracked;
}

/** Resolves once the profile is known: at once if no load is running, failed loads included. */
export function whenProfileReady(): Promise<void> {
  return pendingBoot ? pendingBoot.then(noop, noop) : Promise.resolve();
}

function noop(): void {}
