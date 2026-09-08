import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

// ENS resolution always happens against Sepolia (per PRD: must be live
// ENSv2 resolution, not hardcoded), independent of the app's active
// ChainMode — a user transacting on local Anvil can still have an ENS
// name resolved for display.
//
// Deliberately NOT reusing the shared ethereum-sepolia RPC config here:
// ENS resolution goes through the Universal Resolver's CCIP-read gateway
// calls (eth_call to 0xeeee...eeee with an x-batch-gateway param), and
// the free Ankr endpoint used elsewhere rejects that pattern without an
// API key ("Unauthorized... must authenticate"). viem's bundled default
// Sepolia RPC (thirdweb) handles it fine.
const ensClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

const ENS_CACHE_TTL_MS = 5 * 60 * 1000;
const ENS_CACHE_MAX = 500;

const nameCache = new Map<string, CacheEntry<string | null>>();
const addressCache = new Map<string, CacheEntry<`0x${string}` | null>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > ENS_CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  if (cache.size >= ENS_CACHE_MAX) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { value, timestamp: Date.now() });
}

export async function resolveEnsName(address: `0x${string}`): Promise<string | null> {
  const key = address.toLowerCase();
  const cached = getCached(nameCache, key);
  if (cached !== undefined) return cached;

  try {
    const name = await ensClient.getEnsName({ address });
    setCached(nameCache, key, name);
    return name;
  } catch {
    setCached(nameCache, key, null);
    return null;
  }
}

export async function resolveEnsAddress(name: string): Promise<`0x${string}` | null> {
  const key = name.toLowerCase();
  const cached = getCached(addressCache, key);
  if (cached !== undefined) return cached;

  try {
    const address = await ensClient.getEnsAddress({ name });
    setCached(addressCache, key, address);
    return address;
  } catch {
    setCached(addressCache, key, null);
    return null;
  }
}
