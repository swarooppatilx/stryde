import { services } from '@repo/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type FakePlatform, installFakePlatform, uninstallFakePlatform } from '@/platform/fakes';
import { startRelayQueue } from '@/services/relayQueue';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

// The queue starts once per app run by design, so these tests share one start.
describe('startRelayQueue', () => {
  const drain = vi.spyOn(services.relay, 'drainRelayQueue').mockResolvedValue(undefined as never);
  let isOnline = () => true;
  let platform: FakePlatform;
  let drainsAtStartup = 0;

  beforeAll(async () => {
    vi.spyOn(services.relay, 'setRelayQueueStorage').mockImplementation(() => {});
    vi.spyOn(services.relay, 'setRelayQueueConnectivity').mockImplementation((fn) => {
      isOnline = fn;
    });
    platform = installFakePlatform();
    platform.connectivity.online = false;

    startRelayQueue();
    startRelayQueue();
    await vi.waitFor(() => expect(drain).toHaveBeenCalled());
    drainsAtStartup = drain.mock.calls.length;
  });

  afterAll(() => {
    uninstallFakePlatform();
    vi.restoreAllMocks();
  });

  it('starts once however often it is called, reading the connection at startup', () => {
    expect(drainsAtStartup).toBe(1);
    expect(isOnline()).toBe(false);
  });

  it('replays parked writes the moment the connection comes back', () => {
    drain.mockClear();

    platform.connectivity.setOnline(true);

    expect(isOnline()).toBe(true);
    expect(drain).toHaveBeenCalledTimes(1);
  });

  it('does not drain when the connection drops', () => {
    drain.mockClear();

    platform.connectivity.setOnline(false);

    expect(isOnline()).toBe(false);
    expect(drain).not.toHaveBeenCalled();
  });
});
