import { services } from '@repo/shared';
import { getPlatform } from '@/platform';
import { logger } from '@/utils/logger';
import { chainScopedStorageAdapter } from '@/utils/storage';

let started = false;

/** Wires the relay's offline retry queue to AsyncStorage and connectivity: an unreachable relay parks the write (`{ confirmed: false, queued: true }`) and a reconnect replays it. */
export function startRelayQueue(): void {
  if (started) return;
  started = true;

  const { connectivity } = getPlatform();
  services.relay.setRelayQueueStorage(chainScopedStorageAdapter);

  const drain = () =>
    services.relay
      .drainRelayQueue()
      .catch((error) => logger.warn('[RelayQueue] Replaying queued writes failed', error));

  let online = true;
  let sawEvent = false;
  services.relay.setRelayQueueConnectivity(() => online);

  // Intentionally never unsubscribed: the queue must keep draining for the
  // whole app lifetime.
  connectivity.subscribe((next) => {
    sawEvent = true;
    online = next;
    if (online) void drain();
  });

  void connectivity.isOnline().then((initial) => {
    // The one-shot read can resolve after a live event already reported a newer state.
    if (!sawEvent) online = initial;
    void drain();
  });
}
