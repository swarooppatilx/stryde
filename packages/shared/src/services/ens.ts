import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { createTtlCache } from './cache';

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

const ENS_CACHE_TTL_MS = 5 * 60 * 1000;
const ENS_CACHE_MAX = 500;

const nameCache = createTtlCache<string | null>(ENS_CACHE_TTL_MS, ENS_CACHE_MAX);
const addressCache = createTtlCache<`0x${string}` | null>(ENS_CACHE_TTL_MS, ENS_CACHE_MAX);

export async function resolveEnsName(address: `0x${string}`): Promise<string | null> {
  const key = address.toLowerCase();
  const cached = nameCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const name = await ensClient.getEnsName({ address });
    nameCache.set(key, name);
    return name;
  } catch {
    nameCache.set(key, null);
    return null;
  }
}

export async function resolveEnsAddress(name: string): Promise<`0x${string}` | null> {
  const key = name.toLowerCase();
  const cached = addressCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const address = await ensClient.getEnsAddress({ name });
    addressCache.set(key, address);
    return address;
  } catch {
    addressCache.set(key, null);
    return null;
  }
}
