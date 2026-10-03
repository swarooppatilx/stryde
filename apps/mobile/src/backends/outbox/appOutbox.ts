import { getActiveProfileId } from '@/backends/activeProfile';
import { PROFILES } from '@/backends/profiles';
import { SANDBOX_API_KINDS } from '@/backends/sandbox/sandboxApiKinds';
import { getPlatform } from '@/platform';
import { onlineStatus } from '@/services/onlineStatus';
import { chainScopedStorageAdapter } from '@/utils/storage';
import { ackExcept } from './ackHandlers';
import { createOutbox, type Handler, type Handlers, type Outbox, type OutboxEntry } from './outbox';

const handlers: Handlers = {};
const rejectionHandlers = new Map<string, (entry: OutboxEntry, reason: string) => void>();

/** A feature teaches the outbox how to deliver its intents. Registered where the feature's state lives. */
export function registerOutboxHandler(kind: string, handler: Handler): void {
  handlers[kind] = handler;
}

/** And how to undo its optimistic change when the other side says no for good. */
export function registerRejectionHandler(
  kind: string,
  handler: (entry: OutboxEntry, reason: string) => void
): void {
  rejectionHandlers.set(kind, handler);
}

let instance: Outbox | null = null;

/** The app's one outbox, saved in the active profile's own storage scope. */
export function getOutbox(): Outbox {
  if (!instance) {
    const { clock, ids } = getPlatform();
    const profile = PROFILES[getActiveProfileId()];
    instance = createOutbox({
      storage: chainScopedStorageAdapter,
      clock,
      ids,
      // A profile with no backend acknowledges every intent instead of trying to deliver it, except
      // the ones its stand-in API answers: those are delivered for real, and can fail and retry.
      // (A production build always runs Live, so this only ever applies in development.)
      handlers: profile.fakeChain
        ? ackExcept(handlers, profile.fakeApi ? SANDBOX_API_KINDS : [])
        : handlers,
      isOnline: () => onlineStatus.getSnapshot(),
      onRejected: (entry, reason) => rejectionHandlers.get(entry.kind)?.(entry, reason),
    });
  }
  return instance;
}

/** Forgets the instance, e.g. between tests or after the platform is replaced. */
export function resetOutbox(): void {
  instance = null;
}
