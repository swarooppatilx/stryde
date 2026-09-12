import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockWallet = vi.hoisted(() => ({
  writeContract: vi.fn(),
  account: { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
}));

const mockPublicClient = vi.hoisted(() => ({
  waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' as const }),
}));

vi.mock('../../lib/relayer.js', () => ({
  getRelayerWallet: () => mockWallet,
  getRelayerPublicClient: () => mockPublicClient,
}));

vi.mock('../../lib/chainConfig.js', () => ({
  getRelayChainConfig: () => ({
    chain: { id: 11155111 },
    chainId: 11155111,
    rpcUrl: 'http://mock-rpc',
    contracts: {
      achievementRegistry: '0x0000000000000000000000000000000000000001',
      moveToEarnToken: '0x0000000000000000000000000000000000000002',
      territoryNFT: '0x0000000000000000000000000000000000000003',
      seasonManager: '0x0000000000000000000000000000000000000004',
      profileRegistry: '0x0000000000000000000000000000000000000005',
      activityRegistry: '0x0000000000000000000000000000000000000006',
      territoryRegistry: '0x0000000000000000000000000000000000000007',
    },
  }),
}));

const originalApiKeyImport = process.env.API_KEY;
process.env.API_KEY = 'test-api-key';
const { relay } = await import('../relay.js');
process.env.API_KEY = originalApiKeyImport;

describe('POST /start-season error mapping', () => {
  const originalApiKey = process.env.API_KEY;

  beforeEach(() => {
    process.env.API_KEY = 'test-api-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.API_KEY = originalApiKey;
  });

  const request = (body: unknown) =>
    relay.request('/start-season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-api-key' },
      body: JSON.stringify(body),
    });

  it('returns 409 when the season is already active', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(
      new Error('The contract function reverted with SeasonAlreadyActive')
    );

    const res = await request({ durationSeconds: 86400 });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/season is already active/i);
  });

  it('returns 403 when the relayer is not the contract owner', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(new Error('OwnableUnauthorizedAccount(0xabc)'));

    const res = await request({ durationSeconds: 86400 });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/not authorized/i);
  });

  it('returns 402 when the relayer wallet has no gas', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(
      new Error('insufficient funds for gas * price + value')
    );

    const res = await request({ durationSeconds: 86400 });

    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toMatch(/insufficient funds/i);
  });

  it('returns 503 when the relayer env vars are missing', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(
      new Error('[relayer] Missing env var: RELAYER_PRIVATE_KEY')
    );

    const res = await request({ durationSeconds: 86400 });

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('Service misconfigured');
  });

  it('returns 400 for unmapped errors instead of a raw 500', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(new Error('unexpected boom'));

    const res = await request({ durationSeconds: 86400 });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Relay transaction failed');
  });

  it('passes the local account object (not an address string) to writeContract', async () => {
    mockWallet.writeContract.mockResolvedValueOnce('0xdeadbeef');

    const res = await request({ durationSeconds: 86400 });

    expect(res.status).toBe(200);
    const call = mockWallet.writeContract.mock.calls[0][0] as { account: unknown };
    expect(typeof call.account).not.toBe('string');
    expect(call.account).toBe(mockWallet.account);
  });

  it('returns 401 without a valid API key', async () => {
    const res = await relay.request('/start-season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds: 86400 }),
    });

    expect(res.status).toBe(401);
  });
});
