import { createRemoteJWKSet, type JWTPayload, jwtVerify } from 'jose';

export const WORLD_ISSUER = 'https://auth.world.org';
const DEVICE_AUTHORIZATION_ENDPOINT = `${WORLD_ISSUER}/api/v1/device_authorization`;
const TOKEN_ENDPOINT = `${WORLD_ISSUER}/api/v1/token`;
const JWKS_URI = `${WORLD_ISSUER}/.well-known/jwks.json`;

export const ACR_ORB = 'https://world.org/oidc/acr/orb';
export const ACR_ORB_FACE = 'https://world.org/oidc/acr/orb-face';
export const ACR_SELFIE = 'https://world.org/oidc/acr/selfie';
export const ACR_SELFIE_FACE = 'https://world.org/oidc/acr/selfie-face';

export function getOidcClientId(): string | undefined {
  return process.env.WORLD_OIDC_CLIENT_ID;
}

export function isWorldOidcConfigured(): boolean {
  return Boolean(process.env.WORLD_OIDC_CLIENT_ID && process.env.WORLD_OIDC_CLIENT_SECRET);
}

function clientAuthFields(): Record<string, string> {
  const clientId = process.env.WORLD_OIDC_CLIENT_ID;
  const clientSecret = process.env.WORLD_OIDC_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('World ID OIDC client not configured');
  }
  return { client_id: clientId, client_secret: clientSecret };
}

export interface DeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

/**
 * Starts an RFC 8628 device authorization. Device grants always require a
 * fresh World ID authentication, which is exactly the step-up semantics a
 * sensitive Stryde action needs, and works for agents that can't receive a
 * browser callback.
 */
export async function startDeviceAuthorization(options: {
  acceptableAcr?: string[];
  expectedSub?: string;
}): Promise<DeviceAuthorization> {
  const form = new URLSearchParams({ scope: 'openid', ...clientAuthFields() });

  const idTokenClaims: Record<string, unknown> = {};
  if (options.acceptableAcr?.length) {
    idTokenClaims.acr = { essential: true, values: options.acceptableAcr };
  }
  if (options.expectedSub) {
    idTokenClaims.sub = { value: options.expectedSub };
  }
  if (Object.keys(idTokenClaims).length > 0) {
    form.set('claims', JSON.stringify({ id_token: idTokenClaims }));
  }

  const response = await fetch(DEVICE_AUTHORIZATION_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      `World device authorization failed: ${String(body.error_description ?? body.error ?? response.status)}`
    );
  }

  return {
    deviceCode: String(body.device_code),
    userCode: String(body.user_code),
    verificationUri: String(body.verification_uri),
    verificationUriComplete: String(body.verification_uri_complete ?? body.verification_uri),
    expiresIn: Number(body.expires_in ?? 1200),
    interval: Number(body.interval ?? 5),
  };
}

export type DevicePollResult =
  | { kind: 'pending' }
  | { kind: 'slow_down' }
  | { kind: 'denied'; description: string }
  | { kind: 'expired' }
  | { kind: 'error'; description: string }
  | { kind: 'success'; idToken: string };

export async function pollDeviceToken(deviceCode: string): Promise<DevicePollResult> {
  const form = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCode,
    ...clientAuthFields(),
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (response.ok && typeof body.id_token === 'string') {
    return { kind: 'success', idToken: body.id_token };
  }

  const error = String(body.error ?? '');
  const description = String(body.error_description ?? error ?? response.status);
  switch (error) {
    case 'authorization_pending':
      return { kind: 'pending' };
    case 'slow_down':
      return { kind: 'slow_down' };
    case 'access_denied':
      return { kind: 'denied', description };
    case 'expired_token':
      return { kind: 'expired' };
    default:
      return { kind: 'error', description };
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export interface ValidatedIdentity {
  iss: string;
  sub: string;
  authTime: number;
  acr: string | null;
  amr: string[];
}

export async function validateIdToken(idToken: string): Promise<ValidatedIdentity> {
  const clientId = getOidcClientId();
  if (!clientId) throw new Error('World ID OIDC client not configured');
  jwks ??= createRemoteJWKSet(new URL(JWKS_URI));

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: WORLD_ISSUER,
    audience: clientId,
    algorithms: ['RS256'],
  });
  return identityFromPayload(payload);
}

export function identityFromPayload(payload: JWTPayload): ValidatedIdentity {
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('ID token has no subject');
  }
  if (typeof payload.auth_time !== 'number') {
    throw new Error('ID token has no auth_time');
  }
  return {
    iss: String(payload.iss),
    sub: payload.sub,
    authTime: payload.auth_time,
    acr: typeof payload.acr === 'string' ? payload.acr : null,
    amr: Array.isArray(payload.amr) ? payload.amr.map(String) : [],
  };
}
