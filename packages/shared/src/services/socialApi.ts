import { getIpfsConfig } from './ipfs';

/** A social API call the server answered with an error; `status` is the HTTP status. */
export class SocialApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'SocialApiError';
  }
}

/** One call to `/api/<group>/<path>`, with the app's API key; throws with the server's message. */
export async function apiCall<T>(group: string, path: string, init?: RequestInit): Promise<T> {
  const config = getIpfsConfig();
  if (!config) throw new Error('API not configured: call setIpfsConfig() first');

  const response = await (config.fetch ?? fetch)(`${config.apiUrl}/api/${group}/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new SocialApiError(body.error || `Request failed: ${response.status}`, response.status);
  }
  return response.json() as Promise<T>;
}

/** One call to the social API (`/api/social/...`). */
export const socialCall = <T>(path: string, init?: RequestInit): Promise<T> =>
  apiCall<T>('social', path, init);
