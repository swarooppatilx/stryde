import type { Ring } from '../types';

export interface IpfsConfig {
  /** Base URL of the relay API (packages/api/src/routes/ipfs.ts), e.g. `http://localhost:3000`. */
  apiUrl: string;
  apiKey?: string;
  /** Answers the app's own API calls instead of the network (a profile with no backend); the normal `fetch` when unset. */
  fetch?: typeof fetch;
}

let ipfsConfig: IpfsConfig | null = null;

/** Must be called once at startup (like setChainMode) before any upload function; this package has no env config, so the caller injects the API base URL and key. */
export function setIpfsConfig(config: IpfsConfig): void {
  ipfsConfig = config;
}

export function getIpfsConfig(): IpfsConfig | null {
  return ipfsConfig;
}

export interface IpfsUploadResult {
  cid: string;
  size: number;
}

export interface ActivityMetadata {
  name?: string;
  description?: string;
  photos?: string[];
  /** Encoded route and the closed territory ring, if any: the only durable place either lives, since ActivityRegistry stores only hash/distance/duration/area. */
  polyline?: string;
  territory?: Ring | null;
  /** The route as [lng, lat][] in the same order as the on-chain `polyline` arg to recordActivity(). */
  coordinates?: Array<[number, number]>;
  /** The author asked for this to stay out of other people's Home feeds; apps honour it, the chain does not enforce it. */
  mutedFromFeeds?: boolean;
  /** Stats other people's apps leave out of the card and page (`pace`, `start_time`); display-only, the figures stay readable on the chain. */
  hiddenStats?: string[];
}

const UPLOAD_TIMEOUT_MS = 30_000;
const FETCH_TIMEOUT_MS = 15_000;

/** Uploads JSON to IPFS via the relay API (`POST /api/ipfs/upload`, pinned to Pinata); requires setIpfsConfig() first. */
export async function uploadJsonToIpfs(name: string, content: object): Promise<IpfsUploadResult> {
  if (!ipfsConfig) {
    throw new Error('IPFS not configured — call setIpfsConfig() first');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let response: Response;
  try {
    response = await (ipfsConfig.fetch ?? fetch)(`${ipfsConfig.apiUrl}/api/ipfs/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ipfsConfig.apiKey ? { 'X-API-Key': ipfsConfig.apiKey } : {}),
      },
      body: JSON.stringify({ name, content }),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) throw new Error('IPFS upload timed out');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`IPFS upload failed: ${error}`);
  }

  const result = (await response.json()) as Partial<IpfsUploadResult>;
  if (typeof result.cid !== 'string' || result.cid.length === 0) {
    throw new Error('IPFS upload returned no cid');
  }
  return { cid: result.cid, size: result.size ?? 0 };
}

export function ipfsToHttpUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

/** Fetches JSON pinned via uploadJsonToIpfs from the public gateway (no API key for reads). Returns null on any failure so callers can show what they have. */
export async function fetchJsonFromIpfs<T = Record<string, unknown>>(
  cid: string
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(ipfsToHttpUrl(cid), { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    console.warn(`[ipfs] fetchJsonFromIpfs: failed to fetch cid ${cid}`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
