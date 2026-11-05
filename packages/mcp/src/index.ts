#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

/**
 * Stryde Coach MCP server. Runs on the athlete's machine with an agent token
 * they issued in the Stryde app (World ID approved). Read tools answer
 * directly; anything that moves value returns a World App approval the human
 * must complete — the agent can never approve on their behalf.
 */

const API_URL = (process.env.STRYDE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const TOKEN = process.env.STRYDE_AGENT_TOKEN;

if (!TOKEN) {
  console.error(
    'STRYDE_AGENT_TOKEN is required. Issue one in the Stryde app under Coach → Connect an AI agent.'
  );
  process.exit(1);
}

interface ApiResult {
  status: number;
  body: unknown;
}

async function api(path: string, init: RequestInit = {}): Promise<ApiResult> {
  const res = await fetch(`${API_URL}/api/agent${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  return { status: res.status, body };
}

function text(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function failure(result: ApiResult) {
  return { ...text(result.body), isError: true };
}

const server = new McpServer({ name: 'stryde-coach', version: '0.1.0' });

server.registerTool(
  'get_my_profile',
  {
    title: 'Athlete profile',
    description:
      "The athlete's Stryde snapshot: World verification, recorded activity count, recent activity ids and STRD balance.",
    inputSchema: {},
  },
  async () => {
    const result = await api('/me');
    return result.status === 200 ? text(result.body) : failure(result);
  }
);

server.registerTool(
  'nearby_segments',
  {
    title: 'Nearby segments',
    description: 'Community segments (stored on Arkiv) whose start gate is near a location.',
    inputSchema: {
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    },
  },
  async ({ latitude, longitude }) => {
    const result = await api(`/segments?lat=${latitude}&lng=${longitude}`);
    return result.status === 200 ? text(result.body) : failure(result);
  }
);

server.registerTool(
  'segment_leaderboard',
  {
    title: 'Segment leaderboard',
    description:
      'Fastest efforts on a segment. By default only World-verified humans are ranked; pass scope "all" to include unverified athletes.',
    inputSchema: {
      segmentKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
      scope: z.enum(['verified', 'all']).optional(),
    },
  },
  async ({ segmentKey, scope }) => {
    const result = await api(`/segments/${segmentKey}/leaderboard?scope=${scope ?? 'verified'}`);
    return result.status === 200 ? text(result.body) : failure(result);
  }
);

server.registerTool(
  'my_efforts',
  {
    title: 'My segment efforts',
    description: "The athlete's own segment efforts with sweat scores from their wearable.",
    inputSchema: {},
  },
  async () => {
    const result = await api('/efforts');
    return result.status === 200 ? text(result.body) : failure(result);
  }
);

server.registerTool(
  'request_reward_claim',
  {
    title: 'Request STRD reward claim',
    description:
      'Ask to mint STRD for a recorded activity, at the distance recorded onchain. This does NOT mint immediately: it returns a World App link and code the athlete must approve with a fresh World ID check. Show them the link, then call check_approval.',
    inputSchema: {
      activityId: z.number().int().positive(),
    },
  },
  async ({ activityId }) => {
    const result = await api('/actions/claim_activity_reward', {
      method: 'POST',
      body: JSON.stringify({ params: { activityId } }),
    });
    const body = result.body as {
      approval?: {
        id: string;
        userCode: string;
        verificationUriComplete: string;
        expiresAt: number;
        params: { distanceM?: number };
      };
    };
    if (result.status === 401 && body.approval) {
      const a = body.approval;
      return text(
        [
          'Human approval required (World ID step-up).',
          `Reward for the recorded distance: ${a.params.distanceM ?? '?'} m`,
          `Ask the athlete to open: ${a.verificationUriComplete}`,
          `Code: ${a.userCode}`,
          `Expires: ${new Date(a.expiresAt).toISOString()}`,
          `Then call check_approval with approvalId "${a.id}".`,
        ].join('\n')
      );
    }
    return failure(result);
  }
);

server.registerTool(
  'check_approval',
  {
    title: 'Check approval',
    description:
      'Poll a pending World ID approval. Status is pending, completed, denied, expired, cancelled or failed.',
    inputSchema: { approvalId: z.string().uuid() },
  },
  async ({ approvalId }) => {
    const result = await api(`/approvals/${approvalId}`);
    return result.status === 200 ? text(result.body) : failure(result);
  }
);

await server.connect(new StdioServerTransport());
