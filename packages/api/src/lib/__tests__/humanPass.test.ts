import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.WORLD_OIDC_MOCK = 'true';
  process.env.NODE_ENV = 'test';
});
vi.mock('../relayer.js', () => ({
  getRelayerPublicClient: vi.fn(),
  getRelayerWallet: vi.fn(),
}));

process.env.STORE_FILE = join(mkdtempSync(join(tmpdir(), 'stryde-store-')), 'store.json');

const { decideMockAttempt } = await import('../identityProvider.js');
const humanPass = await import('../humanPass.js');
const { store } = await import('../store.js');
const { ACR_ORB, ACR_SELFIE } = await import('../worldOidc.js');

const WALLET_A = '0x00000000000000000000000000000000000000a1';
const WALLET_B = '0x00000000000000000000000000000000000000b2';
const WALLET_NEW = '0x00000000000000000000000000000000000000c3';
const CLIENT_SECRET = 'client-secret';

type Decision = { kind: 'approve'; sub: string; acr: string } | { kind: 'deny' };

async function runApproval(
  wallet: string,
  action: string,
  decision: Decision,
  params: Record<string, unknown> = {}
) {
  const approval = await humanPass.createApproval({
    wallet,
    action,
    params,
    initiator: 'app',
    clientSecret: CLIENT_SECRET,
  });
  expect(decideMockAttempt(approval.userCode, decision)).toBe(true);
  vi.setSystemTime(Date.now() + 3_000);
  return humanPass.advanceApproval(approval.id);
}

const human = (sub: string, acr = ACR_ORB): Decision => ({ kind: 'approve', sub, acr });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  store.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Human Pass approvals', () => {
  it('links a World ID to a wallet', async () => {
    const result = await runApproval(WALLET_A, 'link_human', human('human-a'));
    expect(result.status).toBe('completed');
    expect(humanPass.humanStatus(WALLET_A).linked).toBe(true);
  });

  it('stays pending until the human decides, and only polls when due', async () => {
    const approval = await humanPass.createApproval({
      wallet: WALLET_A,
      action: 'link_human',
      params: {},
      initiator: 'app',
    });
    expect((await humanPass.advanceApproval(approval.id)).status).toBe('pending');
    vi.setSystemTime(Date.now() + 3_000);
    expect((await humanPass.advanceApproval(approval.id)).status).toBe('pending');
  });

  it('records a decline from World App', async () => {
    const result = await runApproval(WALLET_A, 'link_human', { kind: 'deny' });
    expect(result.status).toBe('denied');
    expect(humanPass.humanStatus(WALLET_A).linked).toBe(false);
  });

  it('refuses to link one human to a second account', async () => {
    await runApproval(WALLET_A, 'link_human', human('human-a'));
    const second = await runApproval(WALLET_B, 'link_human', human('human-a'));
    expect(second.status).toBe('denied');
    expect(second.error).toMatch(/Recover account/);
  });

  it('denies when a different human approves a linked account', async () => {
    await runApproval(WALLET_A, 'link_human', human('human-a'));
    const result = await runApproval(WALLET_A, 'issue_agent_token', human('impostor'));
    expect(result.status).toBe('denied');
  });

  it('rejects authentication older than the attempt', async () => {
    const approval = await humanPass.createApproval({
      wallet: WALLET_A,
      action: 'link_human',
      params: {},
      initiator: 'app',
    });
    const stale = humanPass.authorizeIdentity(approval, {
      iss: 'mock://world-id',
      sub: 'human-a',
      authTime: Math.floor(approval.createdAt / 1000) - 120,
      acr: ACR_ORB,
      amr: [],
    });
    expect(stale).toBe('stale_authentication');
  });

  it('bans follow the human into new accounts', async () => {
    await runApproval(WALLET_A, 'link_human', human('human-a'));
    humanPass.banHuman({ wallet: WALLET_A, reason: 'GPS spoofing' });
    expect(humanPass.isWalletBanned(WALLET_A)).toBe(true);

    await expect(
      humanPass.createApproval({ wallet: WALLET_A, action: 'issue_agent_token', params: {}, initiator: 'app' })
    ).rejects.toMatchObject({ code: 'banned' });

    const evasion = await runApproval(WALLET_NEW, 'link_human', human('human-a'));
    expect(evasion.status).toBe('denied');
    expect(evasion.error).toMatch(/suspended/);
  });

  it('recovers an account onto a new wallet and kills old agent tokens', async () => {
    await runApproval(WALLET_A, 'link_human', human('human-a'));
    const issued = await runApproval(WALLET_A, 'issue_agent_token', human('human-a'), { label: 'Coach' });
    expect(humanPass.consumeOneTimeSecrets(issued, undefined)).not.toHaveProperty('token');
    expect(humanPass.consumeOneTimeSecrets(issued, 'wrong-secret')).not.toHaveProperty('token');
    const secrets = humanPass.consumeOneTimeSecrets(store.getApproval(issued.id)!, CLIENT_SECRET);
    const token = secrets?.token as string;
    expect(token).toMatch(/^stryde_agent_/);
    expect(humanPass.resolveAgentToken(`Bearer ${token}`)?.wallet).toBe(WALLET_A);
    expect(humanPass.consumeOneTimeSecrets(store.getApproval(issued.id)!, CLIENT_SECRET)).not.toHaveProperty(
      'token'
    );

    const recovered = await runApproval(WALLET_NEW, 'recover_account', human('human-a'));
    expect(recovered.status).toBe('completed');
    expect(store.findLinkByWallet(WALLET_NEW)?.previousWallets).toContain(WALLET_A);
    expect(humanPass.resolveAgentToken(`Bearer ${token}`)).toBeNull();
  });

  it('only lets agents request agent-allowed actions', async () => {
    await runApproval(WALLET_A, 'link_human', human('human-a'));
    await expect(
      humanPass.createApproval({ wallet: WALLET_A, action: 'issue_agent_token', params: {}, initiator: 'agent' })
    ).rejects.toMatchObject({ code: 'agent_forbidden' });
    expect(humanPass.AGENT_ACTIONS).toEqual(['claim_activity_reward']);
  });

  it('enforces Orb when the reward policy requires it', () => {
    const policy = humanPass.ACTIONS.claim_activity_reward!;
    policy.acceptableAcr = [ACR_ORB];
    try {
      const approval = {
        action: 'claim_activity_reward',
        createdAt: Date.now(),
        wallet: WALLET_A,
      } as Parameters<typeof humanPass.authorizeIdentity>[0];
      const result = humanPass.authorizeIdentity(approval, {
        iss: 'mock://world-id',
        sub: 'human-a',
        authTime: Math.floor(Date.now() / 1000),
        acr: ACR_SELFIE,
        amr: [],
      });
      expect(result).toBe('insufficient_assurance');
    } finally {
      policy.acceptableAcr = [];
    }
  });
});
