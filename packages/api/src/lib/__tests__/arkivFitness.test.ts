import { beforeEach, describe, expect, it, vi } from 'vitest';

const wallet = vi.hoisted(() => ({
  createEntity: vi.fn(),
  changeOwnership: vi.fn(),
}));

vi.mock('../arkiv.js', () => ({
  arkivConfigFromEnv: () => ({}),
  createArkivPublicClient: () => ({}),
  createArkivWalletClient: () => wallet,
}));

const ATHLETE = '0x00000000000000000000000000000000000000aa';

describe('arkiv fitness writes', () => {
  beforeEach(() => {
    process.env.ARKIV_PRIVATE_KEY =
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    wallet.createEntity.mockReset().mockResolvedValue({ entityKey: '0xkey', txHash: '0xtx' });
    wallet.changeOwnership.mockReset().mockResolvedValue({});
  });

  it('archives a route whose GPS timestamps carry fractional milliseconds', async () => {
    const { createRouteArchive } = await import('../arkivFitness.js');
    await expect(
      createRouteArchive({
        athlete: ATHLETE,
        activityId: 7,
        recordedAt: 1793993276040.847,
        swarmRef: 'a'.repeat(64),
        encrypted: false,
        distanceM: 5012.6,
        pointCount: 120,
        contentType: 'application/gpx+xml',
      })
    ).resolves.toEqual({ key: '0xkey', txHash: '0xtx' });
    expect(wallet.changeOwnership).toHaveBeenCalledWith({ entityKey: '0xkey', newOwner: ATHLETE });
  });

  it('records an effort with fractional timings', async () => {
    const { createEffort } = await import('../arkivFitness.js');
    await expect(
      createEffort({
        segmentKey: '0xseg',
        athlete: ATHLETE,
        elapsedSec: 312.4,
        seasonId: 1,
        verifiedHuman: true,
        sweatVerified: false,
        sweatScore: 61.5,
        avgBpm: 148.2,
        activityId: 7,
        recordedAt: 1793993276040.847,
        swarmRef: null,
      })
    ).resolves.toEqual({ key: '0xkey', txHash: '0xtx' });
  });
});
