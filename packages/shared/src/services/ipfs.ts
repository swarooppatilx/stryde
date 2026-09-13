import type { Ring } from '../types';

export interface IpfsConfig {
  /** Base URL of this app's own relay API (see packages/api/src/routes/ipfs.ts),
   * e.g. `https://api.example.com` or `http://localhost:3000`. */
  apiUrl: string;
  apiKey?: string;
}

let ipfsConfig: IpfsConfig | null = null;

/** Must be called once at app startup (mirrors setChainMode) before any of
 * this module's upload functions are used — packages/shared has no env
 * config of its own, so the API base URL/key are injected by the caller
 * (e.g. apps/mobile's _layout.tsx, using ENV.API_URL / ENV.API_KEY). */
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
  /** Encoded route, and the closed territory ring if this activity captured
   * one — the only durable place either lives. ActivityRegistry itself only
   * stores a hash/distance/duration/area, and a bare polygon/route never fit
   * on-chain economically, so without this a viewer who isn't the device
   * that recorded the run (any other user, or a purely chain-seeded
   * activity) has no map/route thumbnail to render at all. */
  polyline?: string;
  territory?: Ring | null;
}

const UPLOAD_TIMEOUT_MS = 30_000;
const FETCH_TIMEOUT_MS = 15_000;

/** Uploads arbitrary JSON content to IPFS via this app's own relay API
 * (`POST /api/ipfs/upload`), which pins to Pinata — the exact same upload
 * path/pattern as apps/mobile/src/services/ipfsService.ts's uploadToIpfs, so
 * both the mobile client and this shared package hit the same endpoint and
 * request shape. Requires setIpfsConfig() to have been called first. */
export async function uploadJsonToIpfs(
  name: string,
  content: Record<string, unknown>
): Promise<IpfsUploadResult> {
  if (!ipfsConfig) {
    throw new Error('IPFS not configured — call setIpfsConfig() first');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${ipfsConfig.apiUrl}/api/ipfs/upload`, {
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

/** Fetches JSON content previously pinned via uploadJsonToIpfs, straight from
 * the public IPFS gateway (no relay/API-key needed for reads). Returns null
 * — rather than throwing — on any failure, so callers can treat missing/
 * unreachable metadata as "just show what we have" instead of an error. */
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
