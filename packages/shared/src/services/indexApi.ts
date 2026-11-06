import { apiCall, SocialApiError } from './socialApi';

/**
 * One read from the Arkiv index (`/api/index/<path>`). Null when the index cannot answer: the app has
 * no API configured, the request failed, or the server has nothing for it (404). Callers treat null as
 * "no index", exactly as they treated an empty subgraph URL, and fall back to what they did before.
 */
export async function indexCall<T>(path: string): Promise<T | null> {
  try {
    return await apiCall<T>('index', path);
  } catch (e) {
    const notConfigured = e instanceof Error && e.message.startsWith('API not configured');
    const notFound = e instanceof SocialApiError && e.status === 404;
    if (!notConfigured && !notFound) console.warn(`[Index] ${path} failed:`, e);
    return null;
  }
}
