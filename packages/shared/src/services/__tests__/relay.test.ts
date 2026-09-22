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

  it('queues a request instead of hanging forever when the relay never answers', async () => {
    vi.useFakeTimers();
    try {
      // Settle only when the abort signal fires, like a real fetch on a dead socket.
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
          })
      );

      const pending = relayMintReward('0x1234', '0xabcd', 100);
      await vi.advanceTimersByTimeAsync(60_000);

      expect(await pending).toEqual({ confirmed: false, queued: true });
      expect(await getRelayQueueSize()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
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

describe('relay queue under real conditions', () => {
  beforeEach(() => {
    setRelayQueueStorage(new MemoryStorage());
    setRelayQueueConnectivity(() => true);
    mockedGetIpfsConfig.mockReturnValue({ apiUrl: 'https://api.example.com', apiKey: 'k' });
  });

  afterEach(async () => {
    await clearRelayQueue();
    vi.restoreAllMocks();
  });

  const reward = (n: number) => ({ recipient: '0x1', activityHash: `0x${n}`, distance: n });

  it('keeps a request queued while a replay is in flight', async () => {
    await enqueueRelayRequest('mint-reward', reward(1));
    let release: (r: Response) => void = () => {};
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      () => new Promise<Response>((resolve) => (release = resolve))
    );

    const draining = drainRelayQueue();
    await enqueueRelayRequest('mint-reward', reward(2));
    release(new Response(JSON.stringify({ confirmed: true }), { status: 200 }));
    await draining;

    expect(await getRelayQueueSize()).toBe(1);
  });

  it('does not retry an entry again before its backoff has passed', async () => {
    await enqueueRelayRequest('mint-reward', reward(1));
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ error: 'busy' }), { status: 500 }));

    await drainRelayQueue();
    await drainRelayQueue();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await getRelayQueueSize()).toBe(1);
  });

  it('drops a request the relayer rejects for good instead of retrying forever', async () => {
    await enqueueRelayRequest('mint-reward', reward(1));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Relayer is not authorized' }), { status: 403 })
    );

    const result = await drainRelayQueue();

    expect(result.failed).toBe(1);
    expect(await getRelayQueueSize()).toBe(0);
  });

  it('sends through the injected fetch when the config has one', async () => {
    const injected = vi.fn(async () => Response.json({ confirmed: true, hash: '0xfeed' }));
    mockedGetIpfsConfig.mockReturnValue({
      apiUrl: 'http://api.test',
      fetch: injected as typeof fetch,
    });
    const network = vi.spyOn(globalThis, 'fetch');

    expect(await relayMintReward('0x1234', '0xabcd', 100)).toEqual({
      confirmed: true,
      hash: '0xfeed',
    });
    expect(injected).toHaveBeenCalledTimes(1);
    expect(network).not.toHaveBeenCalled();
  });
});
