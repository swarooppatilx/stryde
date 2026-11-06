import type { Context, Next } from 'hono';
import { Hono } from 'hono';
import { formatUnits } from 'viem';
import {
  athleteEfforts,
  findSegmentsNear,
  isArkivConfigured,
  segmentLeaderboard,
} from '../lib/arkivFitness.js';
import { contractAddress, getRelayChainConfig } from '../lib/chainConfig.js';
import { encodeGeohash } from '../lib/fitness/index.js';
import {
  AGENT_ACTIONS,
  advanceApproval,
  createApproval,
  isWalletBanned,
  resolveAgentToken,
  toPublicApproval,
} from '../lib/humanPass.js';
import { RELAY_ABIS } from '../lib/relayAbis.js';
import { getRelayerPublicClient } from '../lib/relayer.js';
import type { AgentGrant } from '../lib/store.js';
import { store } from '../lib/store.js';
import { handleHumanPassError } from './humanPass.js';

type AgentEnv = { Variables: { grant: AgentGrant } };

export const agent = new Hono<AgentEnv>();

const requireAgent = async (c: Context<AgentEnv>, next: Next) => {
  const grant = resolveAgentToken(c.req.header('authorization'));
  if (!grant) {
    c.header('WWW-Authenticate', 'Bearer error="invalid_token"');
    return c.json({ error: 'Invalid or revoked agent token' }, 401);
  }
  if (isWalletBanned(grant.wallet)) {
    return c.json({ error: 'This athlete is suspended from Stryde.' }, 403);
  }
  c.set('grant', grant);
  await next();
};

agent.use('*', requireAgent);

agent.get('/me', async (c) => {
  const grant = c.get('grant');
  const wallet = grant.wallet as `0x${string}`;
  const snapshot: Record<string, unknown> = { wallet, grant: { id: grant.id, label: grant.label } };
  try {
    const config = getRelayChainConfig();
    const client = getRelayerPublicClient();
    const [verified, activityCount, strdBalance] = await Promise.all([
      client.readContract({
        address: contractAddress(config, 'profileRegistry'),
        abi: RELAY_ABIS.profileRegistry,
        functionName: 'isVerified',
        args: [wallet],
      }),
      client.readContract({
        address: contractAddress(config, 'activityRegistry'),
        abi: RELAY_ABIS.activityRegistry,
        functionName: 'getActivityCount',
        args: [wallet],
      }),
      client.readContract({
        address: contractAddress(config, 'moveToEarnToken'),
        abi: RELAY_ABIS.moveToEarnToken,
        functionName: 'balanceOf',
        args: [wallet],
      }),
    ]);
    const count = activityCount as bigint;
    const recentIds = count
      ? ((await client.readContract({
          address: contractAddress(config, 'activityRegistry'),
          abi: RELAY_ABIS.activityRegistry,
          functionName: 'getUserActivityIds',
          args: [wallet, count > 5n ? count - 5n : 0n, 5n],
        })) as readonly bigint[])
      : [];
    Object.assign(snapshot, {
      worldVerifiedOnchain: verified,
      activityCount: Number(count),
      recentActivityIds: recentIds.map(Number),
      strdBalance: formatUnits(strdBalance as bigint, 18),
    });
  } catch (error) {
    snapshot.onchainError = (error as Error).message;
  }
  return c.json(snapshot);
});

/**
 * Sensitive actions answer with an RFC 9470 step-up challenge plus a pending
 * approval: the agent shows the human the World App link and polls until the
 * human approves (or declines) with a fresh World ID authentication.
 */
agent.post('/actions/:action', async (c) => {
  const grant = c.get('grant');
  const action = c.req.param('action');
  if (!AGENT_ACTIONS.includes(action)) {
    return c.json({ error: `Unknown agent action. Available: ${AGENT_ACTIONS.join(', ')}` }, 404);
  }
  const body = (await c.req.json().catch(() => ({}))) as { params?: Record<string, unknown> };
  try {
    const approval = await createApproval({
      wallet: grant.wallet,
      action,
      params: body.params ?? {},
      initiator: 'agent',
      agentGrantId: grant.id,
    });
    c.header(
      'WWW-Authenticate',
      'Bearer error="insufficient_user_authentication", error_description="Fresh World ID approval required", max_age="0"'
    );
    return c.json(
      {
        error: 'human_approval_required',
        message: 'Ask the athlete to approve this in World App, then poll the approval.',
        approval: toPublicApproval(approval),
        poll: `/api/agent/approvals/${approval.id}`,
      },
      401
    );
  } catch (error) {
    return handleHumanPassError(c, error);
  }
});

agent.get('/segments', async (c) => {
  if (!isArkivConfigured()) return c.json({ error: 'Arkiv is not configured on this server' }, 503);
  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return c.json({ error: 'lat and lng required' }, 400);
  }
  return c.json({ segments: await findSegmentsNear(encodeGeohash(lat, lng, 4)) });
});

agent.get('/segments/:key/leaderboard', async (c) => {
  if (!isArkivConfigured()) return c.json({ error: 'Arkiv is not configured on this server' }, 503);
  const key = c.req.param('key');
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return c.json({ error: 'Invalid segment key' }, 400);
  const banned = new Set(store.listBannedWallets());
  const efforts = (
    await segmentLeaderboard(key, { verifiedOnly: c.req.query('scope') !== 'all' })
  ).filter((e) => !banned.has(e.athlete.toLowerCase()));
  return c.json({ segmentKey: key, efforts: efforts.slice(0, 25) });
});

agent.get('/efforts', async (c) => {
  if (!isArkivConfigured()) return c.json({ error: 'Arkiv is not configured on this server' }, 503);
  return c.json({ efforts: await athleteEfforts(c.get('grant').wallet as `0x${string}`) });
});

agent.get('/approvals/:id', async (c) => {
  const grant = c.get('grant');
  const existing = store.getApproval(c.req.param('id'));
  if (!existing || existing.agentGrantId !== grant.id) {
    return c.json({ error: 'Approval not found' }, 404);
  }
  try {
    const approval = await advanceApproval(existing.id);
    return c.json(toPublicApproval(approval));
  } catch (error) {
    return handleHumanPassError(c, error);
  }
});
