import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getIpfsConfig } from '../ipfs';
import {
  clearRelayQueue,
  drainRelayQueue,
  enqueueRelayRequest,
  getRelayQueueSize,
  type RelayQueueStorage,
  relayMintReward,
  setRelayQueueConnectivity,
  setRelayQueueStorage,
} from '../relay';

class MemoryStorage implements RelayQueueStorage {
  private map = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.map.delete(key);
  }
}

vi.mock('../ipfs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ipfs')>();
  return {
    ...actual,
    getIpfsConfig: vi.fn(),
  };
});

const mockedGetIpfsConfig = vi.mocked(getIpfsConfig);

describe('relay queue', () => {
  beforeEach(() => {
    setRelayQueueStorage(new MemoryStorage());
    setRelayQueueConnectivity(() => true);
    mockedGetIpfsConfig.mockReturnValue({
      apiUrl: 'https://api.example.com',
      apiKey: 'test-key',
    });
  });

  afterEach(async () => {
    await clearRelayQueue();
    vi.restoreAllMocks();
  });

  it('parks a request on the queue when the relay is unreachable', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Network request failed'));

    const result = await relayMintReward('0x1234', '0xabcd', 100);

    expect(result).toEqual({ confirmed: false, queued: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await getRelayQueueSize()).toBe(1);
  });

  it('does not duplicate identical queued requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));

    await relayMintReward('0x1234', '0xabcd', 100);
    await relayMintReward('0x1234', '0xabcd', 100);

    expect(await getRelayQueueSize()).toBe(1);
  });

  it('replays the queue once the connection is back', async () => {
    // First attempt: offline.
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Network request failed'));
    await relayMintReward('0x1234', '0xabcd', 100);
    expect(await getRelayQueueSize()).toBe(1);

    // Back online: replay succeeds and the queue empties.
    const okResponse = new Response(JSON.stringify({ hash: '0xf00d', confirmed: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okResponse);

    const result = await drainRelayQueue();

    expect(result).toEqual({ replayed: 1, failed: 0 });
    expect(await getRelayQueueSize()).toBe(0);
  });

  it('skips draining while the device reports offline', async () => {
    setRelayQueueConnectivity(() => false);
    await enqueueRelayRequest('mint-reward', {
      recipient: '0x1',
      activityHash: '0x2',
      distance: 1,
    });

    const sendSpy = vi.spyOn(globalThis, 'fetch');

    const result = await drainRelayQueue();

    expect(result).toEqual({ replayed: 0, failed: 0 });
    expect(sendSpy).not.toHaveBeenCalled();
    expect(await getRelayQueueSize()).toBe(1);
  });

  it('keeps a failed replay on the queue with a backoff timestamp', async () => {
    setRelayQueueConnectivity(() => true);
    await enqueueRelayRequest('mint-reward', {
      recipient: '0x1',
      activityHash: '0x2',
      distance: 1,
    });

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Relay transaction failed'));

    const result = await drainRelayQueue();

    expect(result.failed).toBe(1);
    expect(await getRelayQueueSize()).toBe(1);
  });
});
