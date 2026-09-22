import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { createTtlCache } from './cache';

// ENS resolution always uses Sepolia (live ENSv2), independent of the active ChainMode, so a user on local Anvil still gets a name for display.
//
// Deliberately not the shared ethereum-sepolia RPC config: resolution uses the Universal Resolver's CCIP-read gateway (eth_call with an x-batch-gateway param), which the free Ankr endpoint rejects without an API key. viem's default Sepolia RPC handles it.
const ensClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

// ENSv2 Universal Resolver on Sepolia, wired to the ENSv2 hierarchical ENS Registry (0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e), not the legacy resolver viem defaults to. Source: ensdomains/ens-contracts (staging) deployments/sepolia/UniversalResolver.json, verified to have bytecode on Sepolia; do not replace with an address from elsewhere.
const ENSV2_UNIVERSAL_RESOLVER_SEPOLIA = '0x3c85752a5d47DD09D677C645Ff2A938B38fbFEbA';

const ENS_CACHE_TTL_MS = 5 * 60 * 1000;
const ENS_CACHE_MAX = 500;

const nameCache = createTtlCache<string | null>(ENS_CACHE_TTL_MS, ENS_CACHE_MAX);
const addressCache = createTtlCache<`0x${string}` | null>(ENS_CACHE_TTL_MS, ENS_CACHE_MAX);

export async function resolveEnsName(address: `0x${string}`): Promise<string | null> {
  const key = address.toLowerCase();
  const cached = nameCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const name = await ensClient.getEnsName({
      address,
      universalResolverAddress: ENSV2_UNIVERSAL_RESOLVER_SEPOLIA,
    });
    nameCache.set(key, name);
    return name;
  } catch {
    // Not cached: a network error says nothing about whether the name exists.
    return null;
  }
}

export async function resolveEnsAddress(name: string): Promise<`0x${string}` | null> {
  const key = name.toLowerCase();
  const cached = addressCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const address = await ensClient.getEnsAddress({
      name,
      universalResolverAddress: ENSV2_UNIVERSAL_RESOLVER_SEPOLIA,
    });
    addressCache.set(key, address);
    return address;
  } catch {
    return null;
  }
}

const avatarCache = createTtlCache<string | null>(ENS_CACHE_TTL_MS, ENS_CACHE_MAX);

/** The avatar record of an ENS name as a web URL (IPFS and NFT avatars are resolved), or null. */
export async function resolveEnsAvatar(name: string): Promise<string | null> {
  const key = name.toLowerCase();
  const cached = avatarCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const avatar = await ensClient.getEnsAvatar({
      name,
      universalResolverAddress: ENSV2_UNIVERSAL_RESOLVER_SEPOLIA,
    });
    avatarCache.set(key, avatar);
    return avatar;
  } catch {
    // Not cached: a failed lookup says nothing about whether a record exists.
    return null;
  }
}
