import { services } from '@repo/shared';
import * as Network from 'expo-network';
import { chainScopedStorageAdapter } from '@/utils/storage';

let started = false;

/**
 * Wires the shared relay offline retry queue to on-device persistence and
 * real connectivity signals, and kicks off an initial drain.
 *
 * Relay-backed writes (achievement/reward/territory-NFT mints, season start)
 * used to throw the moment the phone had no signal — the toast said "failed"
 * and the write was lost. With the queue enabled, an unreachable relay parks
 * the request in AsyncStorage and returns `{ confirmed: false, queued: true }`;
 * the moment a connection comes back this listener replays every parked write.
 */
export function startRelayQueue(): void {
  if (started) return;
  started = true;

  services.relay.setRelayQueueStorage(chainScopedStorageAdapter);

  const updateConnectivity = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      services.relay.setRelayQueueConnectivity(() => {
        return (
          state.isConnected !== false &&
          state.isInternetReachable !== false &&
          state.type !== Network.NetworkStateType.NONE
        );
      });
    } catch {
      services.relay.setRelayQueueConnectivity(() => true);
    }
  };

  void updateConnectivity().then(() => {
    services.relay.drainRelayQueue();
  });

  const subscription = Network.addNetworkStateListener((event) => {
    const online =
      event.isConnected !== false &&
      event.isInternetReachable !== false &&
      event.type !== Network.NetworkStateType.NONE;
    services.relay.setRelayQueueConnectivity(() => online);
    if (online) {
      services.relay.drainRelayQueue();
    }
  });

  // Intentionally never unsubscribed: the queue must keep draining for the
  // whole app lifetime. The reference is kept only to silence linters.
  void subscription;
}
