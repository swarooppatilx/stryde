import { keccak256, toBytes } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const WALLET = '0x00000000000000000000000000000000000000aa';

const mockWallet = vi.hoisted(() => ({
  writeContract: vi.fn().mockResolvedValue('0xhash'),
  account: { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
}));

const mockPublicClient = vi.hoisted(() => ({
  simulateContract: vi.fn(async (request: unknown) => ({ request })),
  estimateFeesPerGas: vi.fn(async () => ({ maxFeePerGas: 1n })),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' as const }),
}));

// What the next World poll reports; each test sets it before polling.
const pollStatus = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
  failWith: null as Error | null,
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
    contracts: { profileRegistry: '0x0000000000000000000000000000000000000005' },
  }),
}));

vi.mock('@worldcoin/idkit-server', () => ({
  signRequest: () => ({ sig: '0xsig', nonce: 'nonce', createdAt: 0, expiresAt: 1 }),
}));

vi.mock('@worldcoin/idkit-core', () => {
  const pending = async () => ({
    connectorURI: 'https://world.org/verify?t=1',
    pollOnce: async () => {
      if (pollStatus.failWith) throw pollStatus.failWith;
      return pollStatus.current;
    },
  });
  const builder = () => ({ preset: pending, constraints: pending });
  return {
    IDKitErrorCodes: { UserRejected: 'user_rejected', Cancelled: 'cancelled' },
    CredentialRequest: (type: string, options?: object) => ({ type, ...options }),
    any: (...nodes: unknown[]) => ({ any: nodes }),
    proofOfHuman: () => ({}),
    hashSignal: (signal: string) => mockSignalHash(signal),
    IDKit: { request: builder, proveSession: builder },
  };
});

function mockSignalHash(signal: string): string {
  return `0x${Array.from(signal, (ch) => ch.charCodeAt(0).toString(16))
    .join('')
    .slice(0, 60)}`;
}

/** What World returns for an Athlete Pass enrollment: a Selfie Check uniqueness proof that opened a session. */
function enrollment(nullifier: string) {
  return {
    protocol_version: '4.0',
    action: 'stryde-athlete-pass',
    session_id: 'session_test',
    environment: 'sandbox',
    responses: [
      { identifier: 'selfie', nullifier, signal_hash: mockSignalHash(WALLET), sybil_score: 0 },
    ],
  };
}

const ENV_KEYS = [
  'WORLD_RP_SIGNING_KEY',
  'WORLD_APP_ID',
  'WORLD_RP_ID',
  'WORLD_SKIP_REMOTE_VERIFY',
  'WORLD_PRESENCE_FILE',
  'VERCEL_ENV',
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

// world.ts reads its env at import time, so each scenario re-imports it.
async function loadWorld(env: { skip: boolean; vercelEnv?: string }) {
  vi.resetModules();
  process.env.WORLD_RP_SIGNING_KEY = `0x${'11'.repeat(32)}`;
  process.env.WORLD_APP_ID = 'app_test';
  process.env.WORLD_RP_ID = 'rp_test';
  process.env.WORLD_SKIP_REMOTE_VERIFY = env.skip ? 'true' : 'false';
  process.env.WORLD_PRESENCE_FILE = '';
  if (env.vercelEnv) process.env.VERCEL_ENV = env.vercelEnv;
  else delete process.env.VERCEL_ENV;
  const { world } = await import('../world.js');
  return world;
}

async function startAndPoll(world: Awaited<ReturnType<typeof loadWorld>>) {
  const session = await world.request('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal: WALLET }),
  });
  expect(session.status).toBe(200);
  const { sessionId } = (await session.json()) as { sessionId: string };
  const poll = await world.request(`/session/${sessionId}/poll`, { method: 'POST' });
  return (await poll.json()) as { status: string; error?: string };
}

describe('WORLD_SKIP_REMOTE_VERIFY', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('is ignored on the production deployment: a failed World check stays failed', async () => {
    pollStatus.current = { type: 'failed', error: 'generic_error' };
    const world = await loadWorld({ skip: true, vercelEnv: 'production' });

    const result = await startAndPoll(world);

    expect(result.status).toBe('failed');
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('is ignored on the production deployment: a proof is still sent to World', async () => {
    pollStatus.current = {
      type: 'confirmed',
      result: { responses: [{ nullifier: `0x${'ab'.repeat(32)}` }] },
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response('bad proof', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    const world = await loadWorld({ skip: true, vercelEnv: 'production' });

    const result = await startAndPoll(world);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.status).toBe('failed');
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('confirms a failed check in dev but never writes the fake badge onchain', async () => {
    pollStatus.current = { type: 'failed', error: 'generic_error' };
    const world = await loadWorld({ skip: true });

    const result = await startAndPoll(world);

    expect(result.status).toBe('confirmed');
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('does not mirror an unverified proof onchain in dev', async () => {
    pollStatus.current = {
      type: 'confirmed',
      result: { responses: [{ nullifier: `0x${'ab'.repeat(32)}` }] },
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const world = await loadWorld({ skip: true });

    const result = await startAndPoll(world);

    expect(result.status).toBe('confirmed');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });

  it('mirrors a World-verified proof onchain when the flag is off', async () => {
    const nullifier = `0x${'ab'.repeat(32)}`;
    pollStatus.current = { type: 'confirmed', result: enrollment(nullifier) };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"success":true}')));
    const world = await loadWorld({ skip: false });

    const result = await startAndPoll(world);

    expect(result.status).toBe('confirmed');
    expect(mockWallet.writeContract).toHaveBeenCalledOnce();
    expect(mockWallet.writeContract.mock.calls[0]?.[0]).toMatchObject({
      functionName: 'verify',
      args: [WALLET, nullifier],
    });
  });

  it('retries the onchain mirror after a transient failure', async () => {
    const nullifier = `0x${'ab'.repeat(32)}`;
    pollStatus.current = { type: 'confirmed', result: enrollment(nullifier) };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"success":true}')));
    mockPublicClient.simulateContract.mockRejectedValueOnce(new Error('rpc unreachable'));
    const world = await loadWorld({ skip: false });

    const result = await startAndPoll(world);

    expect(result.status).toBe('confirmed');
    expect(mockPublicClient.simulateContract).toHaveBeenCalledTimes(2);
    expect(mockWallet.writeContract).toHaveBeenCalledOnce();
  }, 10_000);

  it('hashes a nullifier that is not a bytes32, so different values never collide', async () => {
    pollStatus.current = { type: 'confirmed', result: enrollment('raw-id-1') };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"success":true}')));
    const world = await loadWorld({ skip: false });

    await startAndPoll(world);

    await vi.waitFor(() => expect(mockWallet.writeContract).toHaveBeenCalledOnce());
    expect(mockWallet.writeContract.mock.calls[0]?.[0]).toMatchObject({
      args: [WALLET, keccak256(toBytes('raw-id-1'))],
    });
  });

  it('refuses a proof without a nullifier and mirrors nothing, so one human cannot verify many wallets', async () => {
    const { nullifier: _omitted, ...withoutNullifier } = enrollment('x').responses[0] as {
      nullifier: string;
    };
    pollStatus.current = {
      type: 'confirmed',
      result: { ...enrollment('x'), responses: [withoutNullifier] },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"success":true}')));
    const world = await loadWorld({ skip: false });

    const result = await startAndPoll(world);

    expect(result.status).toBe('failed');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });
});

describe('polling a session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
    vi.restoreAllMocks();
  });

  it('keeps waiting while the user has not opened World App yet', async () => {
    pollStatus.current = { type: 'waiting_for_connection' };
    const world = await loadWorld({ skip: false, vercelEnv: 'production' });

    const result = await startAndPoll(world);

    expect(result.status).toBe('pending');
    expect(mockWallet.writeContract).not.toHaveBeenCalled();
  });
});

describe('POST /verify', () => {
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  it.each([
    ['no body', undefined],
    ['a JSON null', 'null'],
    ['not JSON', 'oops'],
  ])('answers 400 for %s instead of crashing', async (_name, body) => {
    const world = await loadWorld({ skip: false });

    const res = await world.request('/verify', { method: 'POST', body });

    expect(res.status).toBe(400);
  });
});

describe('WORLD_SKIP_REMOTE_VERIFY outside Vercel', () => {
  afterEach(() => {
    for (const k of [...ENV_KEYS, 'NODE_ENV'] as const) {
      if (k === 'NODE_ENV') process.env.NODE_ENV = 'test';
      else if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  it('is ignored when NODE_ENV says production, whatever the host', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    pollStatus.current = { type: 'failed', error: 'generic_error' };
    process.env.NODE_ENV = 'production';
    const world = await loadWorld({ skip: true });

    const result = await startAndPoll(world);

    expect(result.status).toBe('failed');
  });
});

describe('POST /session input validation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
    vi.restoreAllMocks();
  });

  const start = (world: Awaited<ReturnType<typeof loadWorld>>, body: unknown) =>
    world.request('/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  it('refuses a signal that is not a wallet address, since nothing could be verified onchain for it', async () => {
    const world = await loadWorld({ skip: true });

    // The signed-out placeholder the app uses before login.
    expect((await start(world, { signal: 'current' })).status).toBe(400);
    expect((await start(world, { signal: 42 })).status).toBe(400);
    expect((await start(world, {})).status).toBe(400);
    expect((await start(world, 'not json')).status).toBe(400);
  });

  it('only sends the person back to the Stryde app', async () => {
    const world = await loadWorld({ skip: true });

    expect(
      (await start(world, { signal: WALLET, return_to: 'https://evil.example/x' })).status
    ).toBe(400);
    expect((await start(world, { signal: WALLET, return_to: 'strydeexpo://verify' })).status).toBe(
      200
    );
    expect((await start(world, { signal: WALLET })).status).toBe(200);
  });

  it('sends people back by the app scheme, and by the old one that builds in the field still use', async () => {
    const world = await loadWorld({ skip: true });

    for (const returnTo of ['stryde://verify', 'strydeexpo://verify']) {
      expect((await start(world, { signal: WALLET, return_to: returnTo })).status, returnTo).toBe(
        200
      );
    }
  });

  it('refuses any other scheme, however close it looks to ours', async () => {
    const world = await loadWorld({ skip: true });

    for (const returnTo of [
      'strydeevil://verify',
      'stryde.evil://verify',
      'javascript:alert(1)',
      'http://stryde://verify',
      'STRYDEX://verify',
    ]) {
      expect((await start(world, { signal: WALLET, return_to: returnTo })).status, returnTo).toBe(
        400
      );
    }
  });

  it('turns away oversized bodies before parsing them', async () => {
    const world = await loadWorld({ skip: true });

    const res = await start(world, { signal: WALLET, padding: 'x'.repeat(20_000) });

    expect(res.status).toBe(413);
  });
});

describe('live session cap', () => {
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
    vi.restoreAllMocks();
  });

  it('stops accepting sessions when too many are pending, instead of growing without bound', async () => {
    const world = await loadWorld({ skip: true });
    const open = () =>
      world.request('/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal: WALLET }),
      });

    const statuses: number[] = [];
    for (let i = 0; i < 1001; i++) statuses.push((await open()).status);

    expect(statuses.slice(0, 1000).every((s) => s === 200)).toBe(true);
    expect(statuses[1000]).toBe(503);
  });
});

describe('poll failures', () => {
  afterEach(() => {
    pollStatus.failWith = null;
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
    vi.restoreAllMocks();
  });

  it('answers an upstream failure with a generic message, never the internal error text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const world = await loadWorld({ skip: true });
    const session = await world.request('/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal: WALLET }),
    });
    const { sessionId } = (await session.json()) as { sessionId: string };
    pollStatus.failWith = new Error('connect ECONNREFUSED 10.0.3.7:443');

    const res = await world.request(`/session/${sessionId}/poll`, { method: 'POST' });

    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('10.0.3.7');
  });
});

describe('POST /verify errors', () => {
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not hand World's raw error body back to the client", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const world = await loadWorld({ skip: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('upstream exploded at internal-host-9', { status: 500 }))
    );

    const res = await world.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idkitResponse: { responses: [] } }),
    });

    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain('internal-host-9');
  });
});
