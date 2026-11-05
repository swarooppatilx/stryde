import { logger } from '@/utils/logger';
import type { AboutText } from './requestAbout';

export interface SyncAboutDeps {
  /** The server's text for this wallet, or null when it has none. */
  fetch(address: `0x${string}`): Promise<AboutText | null>;
  /** True while an edit of the bio or location is still waiting to be sent. */
  hasUnsentChange(): boolean;
  current(): AboutText;
  apply(about: AboutText): void;
}

/**
 * Brings the viewer's own bio and location from the server onto this device (a new phone, a reinstall).
 * A change that has not been sent yet always wins: the server's text is older than what was just typed.
 */
export async function syncOwnAbout(deps: SyncAboutDeps, address: `0x${string}`): Promise<void> {
  if (deps.hasUnsentChange()) return;
  try {
    const server = (await deps.fetch(address)) ?? { bio: '', location: '' };
    // Typing may have started while the request was out.
    if (deps.hasUnsentChange()) return;
    const current = deps.current();
    if (server.bio === current.bio && server.location === current.location) return;
    deps.apply(server);
  } catch (error) {
    logger.warn('[Profile] Could not load your bio:', error);
  }
}
