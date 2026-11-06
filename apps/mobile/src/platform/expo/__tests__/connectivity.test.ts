import { beforeEach, describe, expect, it, vi } from 'vitest';

type State = { isConnected?: boolean; isInternetReachable?: boolean; type?: string };

const getNetworkStateAsync = vi.hoisted(() => vi.fn<() => Promise<State>>());
const listener = vi.hoisted(() => ({ current: null as null | ((state: State) => void) }));

vi.mock('expo-network', () => ({
  NetworkStateType: { NONE: 'NONE', CELLULAR: 'CELLULAR' },
  getNetworkStateAsync,
  addNetworkStateListener: (fn: (state: State) => void) => {
    listener.current = fn;
    return { remove: () => {} };
  },
}));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn() } }));

const { expoConnectivity } = await import('@/platform/expo/connectivity');

const ONLINE: State = { isConnected: true, isInternetReachable: true, type: 'CELLULAR' };
const SECONDARY_NETWORK: State = {
  isConnected: true,
  isInternetReachable: false,
  type: 'CELLULAR',
};
const GONE: State = { isConnected: false, isInternetReachable: false, type: 'NONE' };

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  getNetworkStateAsync.mockReset();
  listener.current = null;
});

describe('expoConnectivity', () => {
  it('reads the current state', async () => {
    getNetworkStateAsync.mockResolvedValue(ONLINE);
    expect(await expoConnectivity.isOnline()).toBe(true);
    getNetworkStateAsync.mockResolvedValue(GONE);
    expect(await expoConnectivity.isOnline()).toBe(false);
  });

  it('assumes online when the state cannot be read', async () => {
    getNetworkStateAsync.mockRejectedValue(new Error('no'));
    expect(await expoConnectivity.isOnline()).toBe(true);
  });

  it('reports online events at once', () => {
    const seen: boolean[] = [];
    expoConnectivity.subscribe((online) => seen.push(online));
    listener.current?.(ONLINE);
    expect(seen).toEqual([true]);
  });

  it('does not go offline because a secondary network reads as unreachable', async () => {
    getNetworkStateAsync.mockResolvedValue(ONLINE);
    const seen: boolean[] = [];
    expoConnectivity.subscribe((online) => seen.push(online));
    listener.current?.(SECONDARY_NETWORK);
    await flush();
    expect(seen).toEqual([true]);
  });

  it('goes offline when the default network is really gone', async () => {
    getNetworkStateAsync.mockResolvedValue(GONE);
    const seen: boolean[] = [];
    expoConnectivity.subscribe((online) => seen.push(online));
    listener.current?.(GONE);
    await flush();
    expect(seen).toEqual([false]);
  });
});
