import { services } from '@repo/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSharedActivityChain } from '@/services/activityChain';

const wallet = { id: 'wallet' } as never;
const ADDRESS = '0x00000000000000000000000000000000000000aa' as const;
const HASH = `0x${'12'.repeat(32)}` as const;

describe('createSharedActivityChain', () => {
  afterEach(() => vi.restoreAllMocks());

  const chain = () => createSharedActivityChain(wallet, ADDRESS);

  it('renames the recorded activity id to the shape the post-run pipeline uses', async () => {
    vi.spyOn(services.activity, 'recordActivity').mockResolvedValue({
      activityId: 7n,
      txHash: '0xtx',
      confirmed: true,
    } as never);

    const result = await chain().recordActivity({
      polyline: 'p',
      activityType: 'run',
      distance: 1,
      duration: 2,
      territoryArea: 0,
      metadata: 'm',
    });

    expect(result).toEqual({ onchainActivityId: 7n, txHash: '0xtx', confirmed: true });
  });

  it('passes through "nothing to store" as null', async () => {
    vi.spyOn(services.activity, 'uploadAndSetActivityMetadata').mockResolvedValue(null as never);

    expect(await chain().setMetadata(1n, {})).toBeNull();
  });

  it('makes sure a season is running before crediting it, with the arguments in order', async () => {
    const calls: string[] = [];
    vi.spyOn(services.season, 'ensureActiveSeason').mockImplementation((async () => {
      calls.push('ensure');
    }) as never);
    const record = vi.spyOn(services.season, 'recordContribution').mockImplementation((async () => {
      calls.push('record');
    }) as never);

    await chain().recordSeasonContribution(HASH, 5000);

    expect(calls).toEqual(['ensure', 'record']);
    expect(record).toHaveBeenCalledWith(wallet, ADDRESS, 5000, HASH);
  });

  it('does not credit a season it could not start', async () => {
    vi.spyOn(services.season, 'ensureActiveSeason').mockRejectedValue(new Error('no season'));
    const record = vi
      .spyOn(services.season, 'recordContribution')
      .mockResolvedValue(undefined as never);

    await expect(chain().recordSeasonContribution(HASH, 5000)).rejects.toThrow('no season');
    expect(record).not.toHaveBeenCalled();
  });

  it('claims a territory with its polygon and area and returns its id', async () => {
    const claim = vi.spyOn(services.territory, 'claimTerritory').mockResolvedValue({
      territoryId: '0xterr',
      confirmed: true,
      txHash: '0xtx',
    } as never);
    const ring: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];

    expect(await chain().claimTerritory(ring, 900)).toEqual({
      territoryId: '0xterr',
      confirmed: true,
    });
    expect(claim).toHaveBeenCalledWith(wallet, { polygon: ring, areaSqm: 900 });
  });

  it('mints the NFT to the athlete, not the relayer', async () => {
    const mint = vi.spyOn(services.territoryNFT, 'mintTerritoryNFT').mockResolvedValue({
      confirmed: true,
    } as never);

    await chain().mintTerritoryNft('0xterr');

    expect(mint).toHaveBeenCalledWith(wallet, '0xterr', ADDRESS);
  });
});
