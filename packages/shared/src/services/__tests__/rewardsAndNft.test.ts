import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  mode: 'local' as 'local' | 'sepolia',
  multicall: vi.fn(),
  readContract: vi.fn(),
  writeAndConfirm: vi.fn(),
  relayMintReward: vi.fn(),
  relayMintTerritoryNFT: vi.fn(),
  parseEventLogs: vi.fn(),
}));

vi.mock('viem', async (importOriginal) => ({
  ...(await importOriginal<typeof import('viem')>()),
  parseEventLogs: state.parseEventLogs,
}));
vi.mock('../client', () => ({
  getChainMode: () => state.mode,
  getContracts: () => ({
    moveToEarnToken: { address: '0xtoken', abi: [] },
    territoryNFT: { address: '0xnft', abi: [] },
  }),
  getPublicClient: () => ({ multicall: state.multicall, readContract: state.readContract }),
}));
vi.mock('../tx', () => ({ writeAndConfirm: state.writeAndConfirm }));
vi.mock('../relay', () => ({
  relayMintReward: state.relayMintReward,
  relayMintTerritoryNFT: state.relayMintTerritoryNFT,
}));

const { mintTokenForActivity } = await import('../moveToEarnToken');
const { getMintedTerritoryIds, mintTerritoryNFT } = await import('../territoryNFT');

const wallet = {} as never;
const ME = '0x00000000000000000000000000000000000000aa' as const;
const HASH = `0x${'ab'.repeat(32)}` as const;

beforeEach(() => {
  vi.clearAllMocks();
  state.mode = 'local';
});

describe('mintTokenForActivity', () => {
  it('on a live network asks the relayer to mint and never signs itself', async () => {
    state.mode = 'sepolia';
    state.relayMintReward.mockResolvedValue({ confirmed: true });

    const result = await mintTokenForActivity(wallet, ME, HASH, 5000);

    expect(state.relayMintReward).toHaveBeenCalledWith(ME, HASH, 5000);
    expect(state.writeAndConfirm).not.toHaveBeenCalled();
    // The relayed mint can't report the amount.
    expect(result).toEqual({ amount: 0n, confirmed: true });
  });

  it('on a local chain also goes through the relayer, since an athlete holds no minter role there either', async () => {
    state.mode = 'local';
    state.relayMintReward.mockResolvedValue({ confirmed: false });

    expect(await mintTokenForActivity(wallet, ME, HASH, 1000)).toEqual({
      amount: 0n,
      confirmed: false,
    });
    expect(state.relayMintReward).toHaveBeenCalledWith(ME, HASH, 1000);
    expect(state.writeAndConfirm).not.toHaveBeenCalled();
  });
});

describe('mintTerritoryNFT', () => {
  it('on a live network goes through the relayer', async () => {
    state.mode = 'sepolia';
    state.relayMintTerritoryNFT.mockResolvedValue({ confirmed: true });

    expect(await mintTerritoryNFT(wallet, HASH, ME)).toEqual({ confirmed: true });
    expect(state.relayMintTerritoryNFT).toHaveBeenCalledWith(ME, HASH);
    expect(state.writeAndConfirm).not.toHaveBeenCalled();
  });

  it('on a local chain goes through the relayer too', async () => {
    state.mode = 'local';
    state.relayMintTerritoryNFT.mockResolvedValue({ confirmed: true });

    expect(await mintTerritoryNFT(wallet, HASH, ME)).toEqual({ confirmed: true });
    expect(state.relayMintTerritoryNFT).toHaveBeenCalledWith(ME, HASH);
    expect(state.writeAndConfirm).not.toHaveBeenCalled();
  });
});

describe('getMintedTerritoryIds', () => {
  const hashes = (n: number) =>
    Array.from({ length: n }, (_, i) => `0x${i.toString(16).padStart(64, '0')}` as `0x${string}`);

  it('does not touch the network for an empty list', async () => {
    expect((await getMintedTerritoryIds([])).size).toBe(0);
    expect(state.multicall).not.toHaveBeenCalled();
  });

  it('checks 100 at a time and keeps each answer with its own hash', async () => {
    const all = hashes(250);
    // Every 3rd hash is minted.
    state.multicall.mockImplementation(async ({ contracts }: { contracts: { args: [string] }[] }) =>
      contracts.map((c) => all.indexOf(c.args[0] as `0x${string}`) % 3 === 0)
    );

    const minted = await getMintedTerritoryIds(all);

    expect(state.multicall).toHaveBeenCalledTimes(3);
    expect(minted.size).toBe(Math.ceil(250 / 3));
    expect(minted.has(all[0] as `0x${string}`)).toBe(true);
    expect(minted.has(all[1] as `0x${string}`)).toBe(false);
    expect(minted.has(all[249] as `0x${string}`)).toBe(249 % 3 === 0);
  });
});
