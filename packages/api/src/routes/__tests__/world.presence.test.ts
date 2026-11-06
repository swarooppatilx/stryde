import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const WALLET = '0x00000000000000000000000000000000000000aa';
const RUN = `0x${'cd'.repeat(32)}`;
const OTHER_RUN = `0x${'ef'.repeat(32)}`;

const pollStatus = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const built = vi.hoisted(() => ({
  calls: [] as Array<{ via: string; config: unknown; with: unknown }>,
}));

vi.mock('../../lib/relayerTx.js', () => ({
  relayTx: vi.fn().mockResolvedValue({ hash: '0xhash', confirmed: true }),
}));

// The registry pre-check reads a registered, unverified profile; no chain client is built.
vi.mock('../../lib/relayer.js', () => ({
  getRelayerPublicClient: () => ({
    readContract: async ({ functionName }: { functionName: string }) =>
      functionName === 'isRegistered',
  }),
}));

vi.mock('../../lib/chainConfig.js', () => ({
  getRelayChainConfig: () => ({
    contracts: { profileRegistry: '0x0000000000000000000000000000000000000005' },
  }),
}));

vi.mock('@worldcoin/idkit-server', () => ({
  signRequest: () => ({ sig: '0xsig', nonce: 'nonce', createdAt: 0, expiresAt: 1 }),
}));

vi.mock('@worldcoin/idkit-core', () => {
  const request = {
    connectorURI: 'https://world.org/verify?t=1',
    pollOnce: async () => pollStatus.current,
  };
  const builder =
    (via: string) =>
    (...args: unknown[]) => ({
      constraints: async (node: unknown) => {
        built.calls.push({ via, config: args.at(-1), with: node });
        return request;
      },
      preset: async (preset: unknown) => {
        built.calls.push({ via, config: args.at(-1), with: preset });
        return request;
      },
    });
  return {
    IDKitErrorCodes: { UserRejected: 'user_rejected', Cancelled: 'cancelled' },
    CredentialRequest: (type: string, options?: object) => ({ type, ...options }),
    any: (...nodes: unknown[]) => ({ any: nodes }),
    proofOfHuman: (options: object) => ({ type: 'ProofOfHuman', ...options }),
    hashSignal: (signal: string) => signalHash(signal),
    IDKit: { request: builder('request'), proveSession: builder('proveSession') },
  };
});

function signalHash(signal: string): string {
  let h = 0n;
  for (const ch of signal) h = (h * 131n + BigInt(ch.charCodeAt(0))) % (1n << 250n);
  return `0x${h.toString(16)}`;
}

const enrollment = (sybil_score: number) => ({
  protocol_version: '4.0',
  action: 'stryde-athlete-pass',
  session_id: 'session_runner',
  environment: 'sandbox',
  responses: [
    { identifier: 'selfie', nullifier: '42', signal_hash: signalHash(WALLET), sybil_score },
  ],
});

const finishLine = (run: string, sessionNullifier = '9001', session_id = 'session_runner') => ({
  protocol_version: '4.0',
  session_id,
  environment: 'sandbox',
  responses: [
    {
      identifier: 'selfie',
      session_nullifier: [sessionNullifier, '1'],
      signal_hash: signalHash(run),
      sybil_score: 0,
    },
  ],
});

async function loadWorld() {
  vi.resetModules();
  process.env.WORLD_RP_SIGNING_KEY = `0x${'11'.repeat(32)}`;
  process.env.WORLD_APP_ID = 'app_test';
  process.env.WORLD_RP_ID = 'rp_test';
  process.env.WORLD_SKIP_REMOTE_VERIFY = 'false';
  process.env.WORLD_PRESENCE_FILE = '';
  return (await import('../world.js')).world;
}

type World = Awaited<ReturnType<typeof loadWorld>>;

async function check(world: World, body: object, result: object) {
  const session = await world.request('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal: WALLET, ...body }),
  });
  if (session.status !== 200) return { httpStatus: session.status, ...(await session.json()) };
  const { sessionId } = (await session.json()) as { sessionId: string };
  pollStatus.current = { type: 'confirmed', result };
  const poll = await world.request(`/session/${sessionId}/poll`, { method: 'POST' });
  return (await poll.json()) as Record<string, unknown>;
}

describe('Signed by a Human', () => {
  beforeEach(() => {
    built.calls = [];
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"success":true}'))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('enrolls with a Selfie Check uniqueness proof that opens a session, bound to the wallet', async () => {
    const world = await loadWorld();
    const result = await check(world, {}, enrollment(0));

    expect(result).toMatchObject({ status: 'confirmed', kind: 'enroll', pass: { band: 'low' } });
    expect(JSON.stringify(result.pass)).not.toContain('session_runner');
    expect(built.calls[0]).toMatchObject({
      via: 'request',
      config: { action: 'stryde-athlete-pass', session_id: 'create', allow_legacy_proofs: false },
      with: {
        any: [
          { type: 'selfie', signal: WALLET },
          { type: 'proof_of_human', signal: WALLET },
        ],
      },
    });
  });

  it('asks for a finish-line check only after enrollment', async () => {
    const world = await loadWorld();
    const result = await check(world, { kind: 'presence', activityHash: RUN }, {});
    expect(result).toMatchObject({ httpStatus: 409, code: 'enroll_required' });
  });

  it('asks for just the credentials WORLD_PASS_CREDENTIALS names', async () => {
    process.env.WORLD_PASS_CREDENTIALS = 'proof_of_human';
    try {
      const world = await loadWorld();
      await check(world, {}, enrollment(0));
      expect(built.calls[0]).toMatchObject({
        with: { type: 'proof_of_human', signal: WALLET },
      });
    } finally {
      delete process.env.WORLD_PASS_CREDENTIALS;
    }
  });

  it('enrolls with an Orb Proof of Human when the person has no Selfie Check credential', async () => {
    const world = await loadWorld();
    const orb = enrollment(0);
    orb.responses = [
      {
        identifier: 'proof_of_human',
        nullifier: '43',
        signal_hash: signalHash(WALLET),
        sybil_score: 0,
      },
    ];
    const result = await check(world, {}, orb);

    expect(result).toMatchObject({ status: 'confirmed', kind: 'enroll', pass: { band: 'low' } });
  });

  it('proves the saved session with the run hash as signal, and issues a ticket for that run', async () => {
    const world = await loadWorld();
    await check(world, {}, enrollment(0));
    const result = await check(world, { kind: 'presence', activityHash: RUN }, finishLine(RUN));

    expect(built.calls[1]).toMatchObject({
      via: 'proveSession',
      with: {
        any: [
          { type: 'selfie', signal: RUN },
          { type: 'proof_of_human', signal: RUN },
        ],
      },
    });
    expect(result).toMatchObject({
      status: 'confirmed',
      ticket: { activityHash: RUN },
      pass: { presenceCount: 1 },
    });

    const pass = await (
      await world.request(`/pass/${WALLET}?activityHash=${RUN}&meters=10000`)
    ).json();
    expect(pass.gate).toMatchObject({ ok: true });
  });

  it('refuses a finish-line proof made for a different run', async () => {
    const world = await loadWorld();
    await check(world, {}, enrollment(0));
    const result = await check(
      world,
      { kind: 'presence', activityHash: RUN },
      finishLine(OTHER_RUN)
    );
    expect(result).toMatchObject({ status: 'failed', error: 'signal_mismatch' });
  });

  it('refuses a replayed session proof and one from another World ID session', async () => {
    const world = await loadWorld();
    await check(world, {}, enrollment(0));
    await check(world, { kind: 'presence', activityHash: RUN }, finishLine(RUN, '7'));
    const replay = await check(
      world,
      { kind: 'presence', activityHash: RUN },
      finishLine(RUN, '7')
    );
    expect(replay).toMatchObject({ status: 'failed', error: 'replayed' });

    const stranger = await check(
      world,
      { kind: 'presence', activityHash: RUN },
      finishLine(RUN, '8', 'session_someone_else')
    );
    expect(stranger).toMatchObject({ status: 'failed', error: 'session_mismatch' });
  });

  it('holds earning for a high Sybil band until Proof of Human', async () => {
    const world = await loadWorld();
    const enrolled = await check(world, {}, enrollment(7));
    expect(enrolled.pass.band).toBe('high');

    const before = await (await world.request(`/pass/${WALLET}?meters=500`)).json();
    expect(before.gate).toMatchObject({ ok: false, code: 'step_up_required' });

    const stepUp = await check(
      world,
      { kind: 'step_up' },
      {
        protocol_version: '4.0',
        action: 'stryde-step-up',
        environment: 'sandbox',
        responses: [
          { identifier: 'proof_of_human', nullifier: '555', signal_hash: signalHash(WALLET) },
        ],
      }
    );
    expect(built.calls.at(-1)).toMatchObject({ with: { type: 'ProofOfHuman', signal: WALLET } });
    expect(stepUp).toMatchObject({ status: 'confirmed', pass: { steppedUp: true } });
  });

  it('shows the athlete the real World error when Selfie Check is unavailable', async () => {
    const world = await loadWorld();
    const session = await world.request('/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal: WALLET }),
    });
    const { sessionId } = (await session.json()) as { sessionId: string };
    pollStatus.current = { type: 'failed', error: 'feature_unavailable' };
    const poll = await (
      await world.request(`/session/${sessionId}/poll`, { method: 'POST' })
    ).json();
    expect(poll).toMatchObject({ status: 'failed', error: 'feature_unavailable' });
    expect(poll.message).toMatch(/run is saved/);
  });
});
