import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMessage } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.WORLD_OIDC_MOCK = 'true';
  process.env.NODE_ENV = 'test';
});
vi.mock('../../lib/relayer.js', () => ({
  getRelayerPublicClient: () => ({ verifyMessage }),
  getRelayerWallet: vi.fn(),
}));

process.env.STORE_FILE = join(mkdtempSync(join(tmpdir(), 'stryde-human-routes-')), 'store.json');

const { humanPass } = await import('../humanPass.js');
const { humanSessionMessage } = await import('../../lib/humanPass.js');
const { store } = await import('../../lib/store.js');

const athlete = privateKeyToAccount(generatePrivateKey());
const victim = privateKeyToAccount(generatePrivateKey());

async function openSession(account = athlete, issuedAt = Date.now(), signer = account) {
  const signature = await signer.signMessage({
    message: humanSessionMessage(account.address, issuedAt),
  });
  return humanPass.request('/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet: account.address, issuedAt, signature }),
  });
}

async function sessionHeaders(account = athlete) {
  const { token } = (await (await openSession(account)).json()) as { token: string };
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

beforeEach(() => store.reset());

describe('/human session', () => {
  it('refuses per-athlete routes without a wallet session', async () => {
    const res = await humanPass.request(`/status?wallet=${athlete.address}`);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'session_required' });
  });

  it('opens a session only for a signature by that wallet', async () => {
    expect((await openSession()).status).toBe(201);
    expect((await openSession(victim, Date.now(), athlete)).status).toBe(401);
  });

  it('refuses a stale proof', async () => {
    expect((await openSession(athlete, Date.now() - 10 * 60_000)).status).toBe(400);
  });

  it('acts for the session wallet, whatever wallet the request names', async () => {
    const headers = await sessionHeaders();
    const res = await humanPass.request('/approvals', {
      method: 'POST',
      headers,
      body: JSON.stringify({ wallet: victim.address, action: 'link_human' }),
    });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(store.getApproval(id)?.wallet).toBe(athlete.address);
  });

  it("can't list or revoke another athlete's agents", async () => {
    store.addAgentGrant({
      id: 'victim-grant',
      tokenHash: 'x',
      iss: 'mock://world-id',
      sub: 'victim',
      wallet: victim.address,
      label: 'Coach',
      createdAt: Date.now(),
      revokedAt: null,
    });
    const headers = await sessionHeaders();

    const status = (await (
      await humanPass.request(`/status?wallet=${victim.address}`, { headers })
    ).json()) as {
      agentGrants: unknown[];
    };
    expect(status.agentGrants).toEqual([]);

    const revoke = await humanPass.request(`/agents/victim-grant?wallet=${victim.address}`, {
      method: 'DELETE',
      headers,
    });
    expect(revoke.status).toBe(404);
    expect(store.listAgentGrants(victim.address)[0]?.revokedAt).toBeNull();
  });
});
