import { HttpRequestError, WaitForTransactionReceiptTimeoutError } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigError } from '../../lib/relayErrors.js';
import { outOfGas, revertedWith } from '../../test-utils/viemErrors.js';

const mockWallet = vi.hoisted(() => ({
  writeContract: vi.fn(),
  account: { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
}));

const mockPublicClient = vi.hoisted(() => ({
  simulateContract: vi.fn(async (request: unknown) => ({ request })),
  getTransaction: vi.fn(async () => ({
    nonce: 1,
    gas: 90_000n,
    value: 0n,
    maxFeePerGas: 100n,
    maxPriorityFeePerGas: 10n,
  })),
  estimateFeesPerGas: vi.fn(async () => ({ maxFeePerGas: 1_000_000_000n })),
  waitForTransactionReceipt: vi
    .fn()
    .mockResolvedValue({ status: 'success' as const, transactionHash: '0xhash' }),
  readContract: vi.fn(),
  getLogs: vi.fn(),
  getBlockNumber: vi.fn(async () => 200n),
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
    deployBlock: 100n,
    subgraphUrl: 'https://subgraph.test/q',
    contracts: {
      achievementRegistry: '0x0000000000000000000000000000000000000001',
      moveToEarnToken: '0x0000000000000000000000000000000000000002',
      territoryNFT: '0x0000000000000000000000000000000000000003',
      seasonManager: '0x0000000000000000000000000000000000000004',
      profileRegistry: '0x0000000000000000000000000000000000000005',
      activityRegistry: '0x0000000000000000000000000000000000000006',
      territoryRegistry: '0x0000000000000000000000000000000000000007',
      challengeRegistry: '0x0000000000000000000000000000000000000008',
    },
  }),
}));

const ledger = vi.hoisted(() => {
  const counted = new Set<string>();
  const pending = new Map<string, string>();
  let nextClaim = 0;
  return {
    counted,
    pending,
    reset() {
      counted.clear();
      pending.clear();
    },
    has: async (hash: string) =>
      counted.has(hash.toLowerCase()) || [...pending.values()].includes(hash.toLowerCase()),
    reserve: async (hash: string) => {
      const claim = `claim-${++nextClaim}`;
      pending.set(claim, hash.toLowerCase());
      return claim;
    },
    release: async (claim: string) => void pending.delete(claim),
    mark: vi.fn(async (hash: string, _participant: string, claim: string) => {
      counted.add(hash.toLowerCase());
      pending.delete(claim);
    }),
  };
});

vi.mock('../../lib/contributionLedgerFromEnv.js', () => ({
  getContributionLedger: () => ledger,
}));

// The subgraph is never called for real: the activity lookup falls back to the mocked logs,
// and each achievement test sets what the eligibility check answers.
const achievementVerdict = vi.hoisted(() => ({
  current: { ok: true, name: 'First Activity' } as
    | { ok: true; name: string }
    | { ok: false; reason: 'unknown' | 'not_earned' },
}));

vi.mock('../../lib/activityProof.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/activityProof.js')>()),
  findRecordedActivityInSubgraph: async () => null,
}));

vi.mock('../../lib/achievementCheck.js', () => ({
  checkAchievement: async () => achievementVerdict.current,
}));

const settlement = vi.hoisted(() => ({
  current: { kind: 'winner', winner: '0x00000000000000000000000000000000000000bb' } as
    | { kind: 'winner'; winner: `0x${string}` }
    | { kind: 'tie' | 'not_found' | 'not_active' | 'not_ended' | 'not_indexed' }
    | Error,
}));

vi.mock('../../lib/challengeSettlement.js', () => ({
  settlementVerdict: async () => {
    if (settlement.current instanceof Error) throw settlement.current;
    return settlement.current;
  },
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

  it('refuses an oversized body before doing anything', async () => {
    const res = await request({ durationSeconds: 86400, filler: 'x'.repeat(20_000) });

    expect(res.status).toBe(413);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('returns 409 when the season is already active', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(revertedWith('SeasonAlreadyActive'));

    const res = await request({ durationSeconds: 86400 });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/season is already active/i);
  });

  it('returns 403 when the relayer is not the contract owner', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(revertedWith('OwnableUnauthorizedAccount'));

    const res = await request({ durationSeconds: 86400 });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/not authorized/i);
  });

  it('returns 402 when the relayer wallet has no gas', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(outOfGas());

    const res = await request({ durationSeconds: 86400 });

    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toMatch(/insufficient funds/i);
  });

  it('returns 503 when the relayer env vars are missing', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(new ConfigError('RELAYER_PRIVATE_KEY'));

    const res = await request({ durationSeconds: 86400 });

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('Service misconfigured');
  });

  it('answers an unrecognised send failure as unconfirmed (503), since the node may have taken it', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(new Error('unexpected boom'));

    const res = await request({ durationSeconds: 86400 });

    expect(res.status).toBe(503);
  });

  it('returns 400 for unmapped errors instead of a raw 500', async () => {
    mockPublicClient.simulateContract.mockRejectedValueOnce(new Error('unexpected boom'));

    const res = await request({ durationSeconds: 86400 });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Relay transaction failed');
  });

  it('passes the local account object (not an address string) to writeContract', async () => {
    mockWallet.writeContract.mockResolvedValueOnce('0xdeadbeef');

    const res = await request({ durationSeconds: 86400 });

    expect(res.status).toBe(200);
    const call = mockWallet.writeContract.mock.calls[0]?.[0] as { account: unknown };
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

describe('POST /mint-achievement', () => {
  const originalApiKey = process.env.API_KEY;
  const RECIPIENT = '0x00000000000000000000000000000000000000aa';
  const ACHIEVEMENT_ID = `0x${'01'.repeat(32)}`;

  beforeEach(() => {
    process.env.API_KEY = 'test-api-key';
    vi.clearAllMocks();
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      status: 'success',
      transactionHash: '0xhash',
    });
    mockWallet.writeContract.mockResolvedValue('0xhash');
  });

  afterEach(() => {
    process.env.API_KEY = originalApiKey;
  });

  const mint = () =>
    relay.request('/mint-achievement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-api-key' },
      body: JSON.stringify({
        recipient: RECIPIENT,
        achievementId: ACHIEVEMENT_ID,
        achievementName: 'First Run',
      }),
    });

  const writtenFunctions = () =>
    mockWallet.writeContract.mock.calls.map((call) => call[0].functionName);

  it('only mints when the achievement type is already defined', async () => {
    mockPublicClient.readContract.mockResolvedValue({ name: 'First Run', exists: true });

    const res = await mint();

    expect(res.status).toBe(200);
    expect(writtenFunctions()).toEqual(['mintAchievement']);
  });

  it('defines the achievement type first when it does not exist yet', async () => {
    mockPublicClient.readContract.mockResolvedValue({ name: '', exists: false });

    const res = await mint();

    expect(res.status).toBe(200);
    expect(writtenFunctions()).toEqual(['defineAchievement', 'mintAchievement']);
  });

  it('defines it under its canonical name, not the name the app sent', async () => {
    mockPublicClient.readContract.mockResolvedValue({ name: '', exists: false });

    await mint();

    expect(mockWallet.writeContract.mock.calls[0]?.[0]).toMatchObject({
      functionName: 'defineAchievement',
      args: [ACHIEVEMENT_ID, 'First Activity'],
    });
  });

  it('refuses a badge the athlete has not earned onchain', async () => {
    achievementVerdict.current = { ok: false, reason: 'not_earned' };

    const res = await mint();

    expect(res.status).toBe(403);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
    achievementVerdict.current = { ok: true, name: 'First Activity' };
  });

  it('refuses an achievement that does not exist', async () => {
    achievementVerdict.current = { ok: false, reason: 'unknown' };

    const res = await mint();

    expect(res.status).toBe(400);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
    achievementVerdict.current = { ok: true, name: 'First Activity' };
  });
});

describe('POST /mint-reward', () => {
  const originalApiKey = process.env.API_KEY;
  const RECORDER = '0x00000000000000000000000000000000000000aa';
  const HASH = `0x${'ab'.repeat(32)}`;

  beforeEach(() => {
    process.env.API_KEY = 'test-api-key';
    vi.clearAllMocks();
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      status: 'success',
      transactionHash: '0xhash',
    });
    mockWallet.writeContract.mockResolvedValue('0xhash');
  });

  afterEach(() => {
    process.env.API_KEY = originalApiKey;
  });

  const post = (body: unknown) =>
    relay.request('/mint-reward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-api-key' },
      body: JSON.stringify(body),
    });

  const recordedBy = (owner: string, distance: bigint) =>
    mockPublicClient.getLogs.mockResolvedValue([{ args: { owner, distance } }]);

  it('pays the wallet that recorded the activity, for the distance it recorded onchain', async () => {
    recordedBy(RECORDER, 4_200n);

    const res = await post({ recipient: RECORDER, activityHash: HASH, distance: 999_999 });

    expect(res.status).toBe(200);
    expect(mockPublicClient.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ args: { activityHash: HASH }, fromBlock: 100n, toBlock: 200n })
    );
    expect(mockWallet.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'mintForActivity',
        args: [RECORDER, HASH, 4_200n],
      })
    );
  });

  it('refuses to pay anyone but the recorder', async () => {
    recordedBy('0x00000000000000000000000000000000000000bb', 4_200n);

    const res = await post({ recipient: RECORDER, activityHash: HASH, distance: 4_200 });

    expect(res.status).toBe(403);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('asks the app to retry when the activity is not visible onchain yet', async () => {
    mockPublicClient.getLogs.mockResolvedValue([]);

    const res = await post({ recipient: RECORDER, activityHash: HASH, distance: 4_200 });

    expect(res.status).toBe(503);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });
});

describe('POST /record-contribution', () => {
  const originalApiKey = process.env.API_KEY;
  const PARTICIPANT = '0x00000000000000000000000000000000000000aa';
  const HASH = `0x${'cd'.repeat(32)}`;

  beforeEach(() => {
    process.env.API_KEY = 'test-api-key';
    vi.clearAllMocks();
    ledger.reset();
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      status: 'success',
      transactionHash: '0xhash',
    });
    mockPublicClient.getLogs.mockResolvedValue([{ args: { owner: PARTICIPANT, distance: 5000n } }]);
    mockWallet.writeContract.mockResolvedValue('0xhash');
  });

  afterEach(() => {
    process.env.API_KEY = originalApiKey;
  });

  const post = (body: unknown, key: string | null = 'test-api-key') =>
    relay.request('/record-contribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'X-API-Key': key } : {}),
      },
      body: JSON.stringify(body),
    });

  it('counts the distance the participant recorded onchain, not the amount sent', async () => {
    const res = await post({ participant: PARTICIPANT, amount: 999_999, activityHash: HASH });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hash: '0xhash', confirmed: true, replaced: false });
    expect(mockWallet.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'recordContribution',
        args: [PARTICIPANT, 5000n],
      })
    );
  });

  it('counts an activity only once', async () => {
    await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });
    mockWallet.writeContract.mockClear();

    const res = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });

    expect(res.status).toBe(409);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('never sends twice when the first send timed out, because it may still mine', async () => {
    mockPublicClient.waitForTransactionReceipt.mockRejectedValue(
      new WaitForTransactionReceiptTimeoutError({ hash: '0xhash' })
    );
    const first = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });
    expect(first.status).toBe(503);
    mockWallet.writeContract.mockClear();

    const replay = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });

    expect(replay.status).toBe(409);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('keeps the claim when the send itself fails ambiguously, so a replay sends nothing', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(
      new HttpRequestError({ url: 'https://rpc.test/v2/abc' })
    );
    const first = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });
    expect(first.status).toBe(503);
    expect(ledger.pending.size).toBe(1);
    mockWallet.writeContract.mockClear();

    const replay = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });

    expect(replay.status).toBe(409);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('frees the claim when the node definitely refuses the send', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(outOfGas());

    const first = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });

    expect(first.status).toBe(402);
    expect(ledger.pending.size).toBe(0);
  });

  it('logs why a transaction could not be confirmed, without leaking the RPC url', async () => {
    const secretUrl = 'https://rpc.test/v2/supersecretkey123';
    vi.stubEnv('RELAYER_RPC_URL', secretUrl);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockWallet.writeContract.mockRejectedValueOnce(new HttpRequestError({ url: secretUrl }));

    await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });

    const output = logged.mock.calls.flat().join(' ');
    expect(output).toContain('not confirmed');
    expect(output).not.toContain('supersecretkey123');
    logged.mockRestore();
    vi.unstubAllEnvs();
  });

  it('keeps the claim, and still answers 200, when the ledger cannot record a counted contribution', async () => {
    ledger.mark.mockRejectedValue(new Error('arkiv down'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const first = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });
    const replay = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });

    expect(first.status).toBe(200);
    expect(ledger.mark).toHaveBeenCalledTimes(3);
    expect(ledger.pending.size).toBe(1);
    expect(replay.status).toBe(409);
    logged.mockRestore();
    ledger.mark.mockReset();
  });

  it('sends a duplicate only once when both arrive together', async () => {
    const [a, b] = await Promise.all([
      post({ participant: PARTICIPANT, activityHash: HASH }),
      post({ participant: PARTICIPANT, activityHash: HASH }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(mockWallet.writeContract).toHaveBeenCalledOnce();
  });

  it("does not hold one athlete's contribution behind another's receipt wait", async () => {
    let mine: (value: unknown) => void = () => {};
    mockPublicClient.waitForTransactionReceipt.mockImplementationOnce(
      () => new Promise((resolve) => (mine = resolve))
    );

    const first = post({ participant: PARTICIPANT, activityHash: HASH });
    const second = post({ participant: PARTICIPANT, activityHash: `0x${'ef'.repeat(32)}` });

    await vi.waitFor(() => expect(mockWallet.writeContract).toHaveBeenCalledTimes(2));
    mine({ status: 'success', transactionHash: '0xhash' });
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
  });

  it('frees the activity for a retry after a definite revert', async () => {
    mockPublicClient.simulateContract.mockRejectedValueOnce(new Error('revert'));
    const first = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });
    expect(first.status).toBe(400);
    expect(ledger.pending.size).toBe(0);

    const retry = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });

    expect(retry.status).toBe(200);
    expect(mockWallet.writeContract).toHaveBeenCalledOnce();
  });

  it('lets the app retry when the write did not confirm', async () => {
    mockPublicClient.waitForTransactionReceipt.mockResolvedValueOnce({
      status: 'reverted',
      transactionHash: '0xhash',
    });
    await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });
    mockWallet.writeContract.mockClear();

    const res = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });

    expect(res.status).toBe(200);
    expect(mockWallet.writeContract).toHaveBeenCalledOnce();
  });

  it('refuses to credit someone else with the activity', async () => {
    mockPublicClient.getLogs.mockResolvedValue([
      { args: { owner: '0x00000000000000000000000000000000000000bb', distance: 5000n } },
    ]);

    const res = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });

    expect(res.status).toBe(403);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('asks the app to retry when the activity is not visible onchain yet', async () => {
    mockPublicClient.getLogs.mockResolvedValue([]);

    const res = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });

    expect(res.status).toBe(503);
  });

  it('rejects a missing API key', async () => {
    const res = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH }, null);

    expect(res.status).toBe(401);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it.each([
    ['no participant', { activityHash: HASH }],
    ['a participant that is not an address', { participant: 'alice', activityHash: HASH }],
    ['no activity hash', { participant: PARTICIPANT, amount: 5000 }],
    ['a malformed activity hash', { participant: PARTICIPANT, activityHash: '0x12' }],
  ])('rejects %s with a 400 and never touches the chain', async (_label, body) => {
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('tells the caller when the relayer is not an allowed recorder', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(revertedWith('NotRecorder'));

    const res = await post({ participant: PARTICIPANT, amount: 5000, activityHash: HASH });

    expect(res.status).toBe(403);
  });
});

describe('POST /mint-territory-nft', () => {
  const originalApiKey = process.env.API_KEY;
  const CLAIMER = '0x00000000000000000000000000000000000000aa';
  const TERRITORY = `0x${'cd'.repeat(32)}`;
  const ZERO = '0x0000000000000000000000000000000000000000';

  beforeEach(() => {
    process.env.API_KEY = 'test-api-key';
    vi.clearAllMocks();
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      status: 'success',
      transactionHash: '0xhash',
    });
    mockWallet.writeContract.mockResolvedValue('0xhash');
  });

  afterEach(() => {
    process.env.API_KEY = originalApiKey;
  });

  const post = (body: unknown) =>
    relay.request('/mint-territory-nft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-api-key' },
      body: JSON.stringify(body),
    });

  const controlledBy = (controller: string) =>
    mockPublicClient.readContract.mockResolvedValue({ controller });

  it('mints the territory to the athlete who controls it', async () => {
    controlledBy(CLAIMER);

    const res = await post({ recipient: CLAIMER, polygonHash: TERRITORY });

    expect(res.status).toBe(200);
    expect(mockPublicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'getTerritory', args: [TERRITORY] })
    );
    expect(mockWallet.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'mintTerritory', args: [CLAIMER, TERRITORY] })
    );
  });

  it('refuses a territory someone else controls', async () => {
    controlledBy('0x00000000000000000000000000000000000000bb');

    const res = await post({ recipient: CLAIMER, polygonHash: TERRITORY });

    expect(res.status).toBe(403);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('asks the app to retry when the claim is not visible onchain yet', async () => {
    controlledBy(ZERO);

    const res = await post({ recipient: CLAIMER, polygonHash: TERRITORY });

    expect(res.status).toBe(503);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });
});

describe('relay input validation', () => {
  const originalApiKey = process.env.API_KEY;
  const ADDR = '0x00000000000000000000000000000000000000aa';
  const HASH = `0x${'01'.repeat(32)}`;

  beforeEach(() => {
    process.env.API_KEY = 'test-api-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.API_KEY = originalApiKey;
  });

  const post = (path: string, body: unknown) =>
    relay.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-api-key' },
      body: JSON.stringify(body),
    });

  it.each([
    ['/mint-reward', { recipient: 'bob', activityHash: HASH, distance: 5000 }],
    ['/mint-reward', { recipient: ADDR, activityHash: '0x12', distance: 5000 }],
    ['/mint-reward', { recipient: ADDR, activityHash: HASH, distance: -5 }],
    ['/mint-reward', { recipient: ADDR, activityHash: HASH, distance: 'far' }],
    ['/mint-reward', { recipient: ADDR, activityHash: HASH, distance: 99_999_999 }],
    ['/mint-territory-nft', { recipient: ADDR, polygonHash: 'nope' }],
    ['/mint-territory-nft', { recipient: '0x1', polygonHash: HASH }],
    ['/mint-achievement', { recipient: ADDR, achievementId: '0x1', achievementName: 'x' }],
    ['/mint-achievement', { recipient: 'bob', achievementId: HASH, achievementName: 'x' }],
    ['/start-season', { durationSeconds: -1 }],
    ['/start-season', { durationSeconds: 'soon' }],
    ['/start-season', { durationSeconds: 10 * 366 * 24 * 3600 }],
  ])('rejects %s with %j before spending any gas', async (path, body) => {
    const res = await post(path, body);

    expect(res.status).toBe(400);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });
});

describe('relayer safety nets', () => {
  const originalApiKey = process.env.API_KEY;
  const originalCap = process.env.RELAYER_MAX_FEE_GWEI;

  beforeEach(() => {
    process.env.API_KEY = 'test-api-key';
    vi.clearAllMocks();
    mockWallet.writeContract.mockResolvedValue('0xhash');
  });

  afterEach(() => {
    process.env.API_KEY = originalApiKey;
    if (originalCap === undefined) delete process.env.RELAYER_MAX_FEE_GWEI;
    else process.env.RELAYER_MAX_FEE_GWEI = originalCap;
  });

  const startSeason = () =>
    relay.request('/start-season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-api-key' },
      body: JSON.stringify({ durationSeconds: 86400 }),
    });

  it('answers a call that would revert without ever sending it', async () => {
    mockPublicClient.simulateContract.mockRejectedValueOnce(revertedWith('NotRecorder'));

    const res = await startSeason();

    expect(res.status).toBe(403);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('answers 503 and sends nothing while gas is above the configured cap', async () => {
    process.env.RELAYER_MAX_FEE_GWEI = '0.5';

    const res = await startSeason();

    expect(res.status).toBe(503);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('sends when gas is within the cap', async () => {
    process.env.RELAYER_MAX_FEE_GWEI = '5';

    expect((await startSeason()).status).toBe(200);
  });
});

describe('POST /settle-challenge', () => {
  beforeEach(() => {
    process.env.API_KEY = 'test-api-key';
    vi.clearAllMocks();
    settlement.current = { kind: 'winner', winner: '0x00000000000000000000000000000000000000bb' };
  });

  const request = (body: unknown) =>
    relay.request('/settle-challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-api-key' },
      body: JSON.stringify(body),
    });

  it('settles for whoever the indexed record says ran further, never for a caller-named winner', async () => {
    mockWallet.writeContract.mockResolvedValueOnce('0xabc');

    const res = await request({
      challengeId: '7',
      winner: '0x00000000000000000000000000000000000000aa',
    });

    expect(res.status).toBe(200);
    const sent = mockWallet.writeContract.mock.calls[0]?.[0] as {
      functionName: string;
      args: unknown[];
    };
    expect(sent.functionName).toBe('settleChallenge');
    expect(sent.args).toEqual([7n, '0x00000000000000000000000000000000000000bb']);
  });

  it.each([[{}], [{ challengeId: 'abc' }], [{ challengeId: '-1' }], [{ challengeId: 7.5 }]])(
    'rejects a missing or malformed challenge id (%j)',
    async (body) => {
      const res = await request(body);

      expect(res.status).toBe(400);
      expect(mockWallet.writeContract).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['tie', 409, /tied/i],
    ['not_ended', 409, /not over/i],
    ['not_active', 409, /not open/i],
    ['not_found', 404, /unknown/i],
    ['not_indexed', 503, /try again/i],
  ] as const)('answers %s with %i and sends nothing', async (kind, status, message) => {
    settlement.current = { kind };

    const res = await request({ challengeId: '7' });

    expect(res.status).toBe(status);
    expect((await res.json()).error).toMatch(message);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('asks the app to retry when the indexer is down', async () => {
    settlement.current = new Error('Subgraph request failed: 502');

    const res = await request({ challengeId: '7' });

    expect(res.status).toBe(503);
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('maps the contract refusing the relayer to 403 and a closed window to 409', async () => {
    mockWallet.writeContract.mockRejectedValueOnce(revertedWith('NotSettler'));
    expect((await request({ challengeId: '7' })).status).toBe(403);

    mockWallet.writeContract.mockRejectedValueOnce(revertedWith('SettleWindowClosed'));
    expect((await request({ challengeId: '7' })).status).toBe(409);
  });
});
