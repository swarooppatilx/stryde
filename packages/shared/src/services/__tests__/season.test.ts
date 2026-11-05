import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setIpfsConfig } from '../ipfs';
import { recordContribution } from '../season';

const ADDRESS = '0x00000000000000000000000000000000000000aa' as const;
const HASH = `0x${'cd'.repeat(32)}` as const;

describe('season.recordContribution on a live network', () => {
  const fetchMock = vi.fn();
  const writeContract = vi.fn();
  const sentRequest = () => fetchMock.mock.calls[0] as [string, { body: string }];

  beforeEach(() => {
    setIpfsConfig({ apiUrl: 'https://relay.test', apiKey: 'k' });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ hash: '0xabc', confirmed: true }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // SeasonManager only lets the owner/allowed recorders write contributions, so
  // an ordinary user's own wallet cannot — the relayer has to.
  it('goes through the relayer, not the user wallet', async () => {
    const wallet = { account: { address: ADDRESS }, writeContract } as never;

    const result = await recordContribution(wallet, ADDRESS, 5000, HASH);

    expect(result).toEqual({ confirmed: true });
    expect(writeContract).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = sentRequest();
    expect(url).toBe('https://relay.test/api/relay/record-contribution');
    expect(JSON.parse(init.body)).toEqual({
      participant: ADDRESS,
      amount: 5000,
      activityHash: HASH,
    });
  });

  it('sends whole meters', async () => {
    const wallet = { account: { address: ADDRESS }, writeContract } as never;

    await recordContribution(wallet, ADDRESS, 4999.6, HASH);

    expect(JSON.parse(sentRequest()[1].body).amount).toBe(5000);
  });

  it('reports an unconfirmed relay as not confirmed', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ hash: '0xabc', confirmed: false }), { status: 200 })
    );
    const wallet = { account: { address: ADDRESS }, writeContract } as never;

    expect(await recordContribution(wallet, ADDRESS, 5000, HASH)).toEqual({ confirmed: false });
  });
});
