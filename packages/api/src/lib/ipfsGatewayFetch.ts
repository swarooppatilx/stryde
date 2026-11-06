const CID_SHAPE = /^[A-Za-z0-9]{40,120}$/;
const DEFAULT_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

export interface GatewayFetchOptions {
  fetchImpl?: typeof fetch;
  gateway?: string;
  maxBytes?: number;
  timeoutMs?: number;
}

/**
 * Reads the JSON a CID points at through a public gateway. CIDs come out of chain events, which
 * anyone can write, so the shape is checked before a URL is built and the body is size-capped.
 */
export function createGatewayFetch({
  fetchImpl = fetch,
  gateway = DEFAULT_GATEWAY,
  maxBytes = 256 * 1024,
  timeoutMs = 8_000,
}: GatewayFetchOptions = {}) {
  return async (cid: string): Promise<unknown> => {
    if (!CID_SHAPE.test(cid)) throw new Error('not a CID');
    const res = await fetchImpl(`${gateway}${cid}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`gateway answered ${res.status}`);
    const text = await res.text();
    if (text.length > maxBytes) throw new Error('metadata too large');
    return JSON.parse(text);
  };
}
