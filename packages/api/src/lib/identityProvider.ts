import { randomBytes } from 'node:crypto';
import {
  ACR_ORB,
  type DeviceAuthorization,
  type DevicePollResult,
  isWorldOidcConfigured,
  pollDeviceToken,
  startDeviceAuthorization,
  type ValidatedIdentity,
  validateIdToken,
  WORLD_ISSUER,
} from './worldOidc.js';

/**
 * Seam between Human Pass and the World ID issuer. Production always uses the
 * real OIDC device flow; `WORLD_OIDC_MOCK=true` swaps in a local approval page
 * so the full flow can be exercised on a dev machine without portal
 * credentials. Mock mode is refused when NODE_ENV=production.
 */
export interface IdentityProvider {
  readonly mode: 'world' | 'mock';
  start(options: { acceptableAcr?: string[]; expectedSub?: string }): Promise<DeviceAuthorization>;
  poll(deviceCode: string): Promise<DevicePollResult>;
  validate(idToken: string): Promise<ValidatedIdentity>;
}

const worldProvider: IdentityProvider = {
  mode: 'world',
  start: startDeviceAuthorization,
  poll: pollDeviceToken,
  validate: validateIdToken,
};

export const MOCK_ISSUER = 'mock://world-id';

interface MockAttempt {
  deviceCode: string;
  userCode: string;
  createdAt: number;
  expectedSub: string | undefined;
  decision: { kind: 'approve'; sub: string; acr: string } | { kind: 'deny' } | null;
  redeemed: boolean;
}

const mockAttempts = new Map<string, MockAttempt>();

function publicApiUrl(): string {
  return (process.env.PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function getMockAttemptByUserCode(userCode: string): MockAttempt | undefined {
  for (const attempt of mockAttempts.values()) {
    if (attempt.userCode === userCode) return attempt;
  }
  return undefined;
}

export function decideMockAttempt(
  userCode: string,
  decision: { kind: 'approve'; sub: string; acr: string } | { kind: 'deny' }
): boolean {
  const attempt = getMockAttemptByUserCode(userCode);
  if (!attempt || attempt.decision) return false;
  attempt.decision = decision;
  return true;
}

const mockProvider: IdentityProvider = {
  mode: 'mock',
  async start(options) {
    const deviceCode = randomBytes(24).toString('hex');
    const userCode = randomBytes(4).toString('hex').toUpperCase();
    mockAttempts.set(deviceCode, {
      deviceCode,
      userCode,
      createdAt: Date.now(),
      expectedSub: options.expectedSub,
      decision: null,
      redeemed: false,
    });
    const verificationUri = `${publicApiUrl()}/api/human/mock/verify`;
    return {
      deviceCode,
      userCode,
      verificationUri,
      verificationUriComplete: `${verificationUri}?code=${userCode}`,
      expiresIn: 600,
      interval: 2,
    };
  },
  async poll(deviceCode) {
    const attempt = mockAttempts.get(deviceCode);
    if (!attempt || attempt.redeemed) return { kind: 'error', description: 'invalid_grant' };
    if (Date.now() - attempt.createdAt > 600_000) return { kind: 'expired' };
    if (!attempt.decision) return { kind: 'pending' };
    if (attempt.decision.kind === 'deny') {
      return { kind: 'denied', description: 'The user declined the request in World App.' };
    }
    if (attempt.expectedSub && attempt.expectedSub !== attempt.decision.sub) {
      return {
        kind: 'denied',
        description: 'Authenticated account does not match the requested subject.',
      };
    }
    attempt.redeemed = true;
    const authTime = Math.floor(Date.now() / 1000);
    const payload = { sub: attempt.decision.sub, acr: attempt.decision.acr, auth_time: authTime };
    return {
      kind: 'success',
      idToken: `mock.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`,
    };
  },
  async validate(idToken) {
    if (!idToken.startsWith('mock.')) throw new Error('Not a mock token');
    const payload = JSON.parse(Buffer.from(idToken.slice(5), 'base64url').toString('utf8')) as {
      sub: string;
      acr: string;
      auth_time: number;
    };
    return {
      iss: MOCK_ISSUER,
      sub: payload.sub,
      authTime: payload.auth_time,
      acr: payload.acr,
      amr: payload.acr === ACR_ORB ? ['pop', 'iris'] : ['pop', 'face'],
    };
  },
};

export function isMockIdentityEnabled(): boolean {
  return process.env.WORLD_OIDC_MOCK === 'true' && process.env.NODE_ENV !== 'production';
}

export function getIdentityProvider(): IdentityProvider | null {
  if (isMockIdentityEnabled()) return mockProvider;
  if (isWorldOidcConfigured()) return worldProvider;
  return null;
}

export function expectedIssuer(): string {
  return isMockIdentityEnabled() ? MOCK_ISSUER : WORLD_ISSUER;
}
