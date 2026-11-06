import { randomBytes } from 'node:crypto';
import type { Context } from 'hono';
import { Hono } from 'hono';
import {
  advanceApproval,
  banHuman,
  cancelApproval,
  consumeOneTimeSecrets,
  createApproval,
  HumanPassError,
  humanStatus,
  toPublicApproval,
  unbanHuman,
} from '../lib/humanPass.js';
import {
  decideMockAttempt,
  getIdentityProvider,
  getMockAttemptByUserCode,
  isMockIdentityEnabled,
} from '../lib/identityProvider.js';
import { store } from '../lib/store.js';
import { ACR_ORB, ACR_SELFIE } from '../lib/worldOidc.js';

export const humanPass = new Hono();

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function handleHumanPassError(c: Context, error: unknown) {
  if (error instanceof HumanPassError) {
    return c.json({ error: error.message, code: error.code }, error.status);
  }
  console.error('[human] Unexpected error:', error);
  return c.json({ error: 'Human Pass request failed' }, 500);
}

function requireAdmin(c: Context) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey || c.req.header('x-admin-key') !== adminKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return undefined;
}

humanPass.get('/status', (c) => {
  const wallet = c.req.query('wallet') ?? '';
  if (!HEX_ADDRESS_RE.test(wallet)) return c.json({ error: 'wallet query param required' }, 400);
  const provider = getIdentityProvider();
  return c.json({
    configured: Boolean(provider),
    mode: provider?.mode ?? null,
    ...humanStatus(wallet),
  });
});

humanPass.post('/approvals', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    wallet?: string;
    action?: string;
    params?: Record<string, unknown>;
  } | null;
  if (!body?.wallet || !body.action)
    return c.json({ error: 'wallet and action are required' }, 400);
  try {
    const clientSecret = randomBytes(24).toString('base64url');
    const approval = await createApproval({
      wallet: body.wallet,
      action: body.action,
      params: body.params ?? {},
      initiator: 'app',
      clientSecret,
    });
    return c.json({ ...toPublicApproval(approval), clientSecret }, 201);
  } catch (error) {
    return handleHumanPassError(c, error);
  }
});

humanPass.get('/approvals', (c) => {
  const wallet = c.req.query('wallet') ?? '';
  if (!HEX_ADDRESS_RE.test(wallet)) return c.json({ error: 'wallet query param required' }, 400);
  return c.json({ approvals: store.listApprovals(wallet).slice(0, 20).map(toPublicApproval) });
});

humanPass.get('/approvals/:id', async (c) => {
  const wallet = c.req.query('wallet') ?? '';
  try {
    const existing = store.getApproval(c.req.param('id'));
    if (!existing || existing.wallet.toLowerCase() !== wallet.toLowerCase()) {
      return c.json({ error: 'Approval not found' }, 404);
    }
    const approval = await advanceApproval(existing.id);
    const result = consumeOneTimeSecrets(approval, c.req.header('x-approval-secret'));
    return c.json({ ...toPublicApproval(approval), result });
  } catch (error) {
    return handleHumanPassError(c, error);
  }
});

humanPass.post('/approvals/:id/cancel', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { wallet?: string } | null;
  try {
    const approval = cancelApproval(c.req.param('id'), body?.wallet ?? '');
    return c.json(toPublicApproval(approval));
  } catch (error) {
    return handleHumanPassError(c, error);
  }
});

humanPass.delete('/agents/:id', (c) => {
  const wallet = c.req.query('wallet') ?? '';
  const revoked = store.revokeAgentGrant(c.req.param('id'), wallet);
  return revoked ? c.json({ revoked: true }) : c.json({ error: 'Agent grant not found' }, 404);
});

humanPass.get('/banned', (c) => c.json({ wallets: store.listBannedWallets() }));

humanPass.post('/bans', async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;
  const body = (await c.req.json().catch(() => null)) as {
    wallet?: string;
    sub?: string;
    reason?: string;
  } | null;
  if (!body?.wallet && !body?.sub) return c.json({ error: 'wallet or sub required' }, 400);
  try {
    const result = banHuman({
      wallet: body.wallet,
      sub: body.sub,
      reason: body.reason ?? 'GPS spoofing',
    });
    return c.json({ banned: true, ...result });
  } catch (error) {
    return handleHumanPassError(c, error);
  }
});

humanPass.delete('/bans', async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;
  const wallet = c.req.query('wallet') ?? '';
  return c.json({ unbanned: unbanHuman(wallet) });
});

const MOCK_PERSONAS = [
  { id: 'athlete-a', label: 'Athlete A (Orb)', acr: ACR_ORB },
  { id: 'athlete-b', label: 'Athlete B (Selfie Check)', acr: ACR_SELFIE },
  { id: 'impostor', label: 'Someone else (Orb)', acr: ACR_ORB },
];

humanPass.get('/mock/verify', (c) => {
  if (!isMockIdentityEnabled()) return c.text('Not found', 404);
  const code = c.req.query('code') ?? '';
  const attempt = getMockAttemptByUserCode(code);
  const decided = attempt?.decision ? `<p class="done">Already answered.</p>` : '';
  const buttons = MOCK_PERSONAS.map(
    (p) => `<button name="persona" value="${p.id}">Approve as ${p.label}</button>`
  ).join('');
  return c.html(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>World ID (mock)</title><style>
body{font-family:system-ui;background:#0b0b0f;color:#fff;padding:24px;max-width:420px;margin:auto}
.code{font-size:28px;letter-spacing:4px;font-weight:700;margin:12px 0 24px}
button{display:block;width:100%;padding:14px;margin:10px 0;border-radius:12px;border:0;font-size:16px;background:#fff;color:#000}
button.deny{background:#2a2a33;color:#ff6b6b}.done{color:#8f8}small{color:#999}
</style></head><body>
<h2>World ID — mock approval</h2><small>Local development only. Production uses auth.world.org.</small>
<div class="code">${attempt ? attempt.userCode : 'Unknown code'}</div>${decided}
<form method="post" action="/api/human/mock/verify"><input type="hidden" name="code" value="${code}">
${buttons}<button class="deny" name="persona" value="deny">Decline</button></form>
</body></html>`);
});

function mockVerifyHeading(answered: boolean, approved: boolean): string {
  if (!answered) return 'This request was already answered or expired';
  return approved ? 'Approved' : 'Declined';
}

humanPass.post('/mock/verify', async (c) => {
  if (!isMockIdentityEnabled()) return c.text('Not found', 404);
  const form = await c.req.parseBody();
  const code = String(form.code ?? '');
  const personaId = String(form.persona ?? '');
  const persona = MOCK_PERSONAS.find((p) => p.id === personaId);
  const ok = decideMockAttempt(
    code,
    persona ? { kind: 'approve', sub: `mock-${persona.id}`, acr: persona.acr } : { kind: 'deny' }
  );
  const heading = mockVerifyHeading(ok, Boolean(persona));
  return c.html(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui;background:#0b0b0f;color:#fff;padding:24px">
<h2>${heading}</h2>
<p>You can return to Stryde now.</p></body></html>`
  );
});
