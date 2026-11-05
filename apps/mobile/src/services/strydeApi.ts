import { ENV } from '@/constants/config';

export class StrydeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown
  ) {
    super(message);
  }
}

/** JSON fetch against the Stryde API with the shared app key. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${ENV.API_URL}/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(ENV.API_KEY ? { 'X-API-Key': ENV.API_KEY } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message =
      (body && typeof body === 'object' && ('message' in body || 'error' in body)
        ? String((body as { message?: string }).message ?? (body as { error?: string }).error)
        : '') || `Request failed (${response.status})`;
    throw new StrydeApiError(message, response.status, body);
  }
  return body as T;
}

export function isNotConfigured(error: unknown): boolean {
  return error instanceof StrydeApiError && error.status === 503;
}
