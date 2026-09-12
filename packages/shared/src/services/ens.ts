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

// ENSv2's Universal Resolver on Sepolia, wired to ENSv2's new hierarchical
// ENS Registry (0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e — passed as its
// registry constructor arg), NOT the legacy Universal Resolver viem defaults
// to for the Sepolia chain definition. Source: ensdomains/ens-contracts
// (staging branch) deployments/sepolia/UniversalResolver.json — verified
// on-chain (has deployed bytecode at this address on Sepolia) before use;
// do not swap this for a paraphrased/relayed address from anywhere else.
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
    nameCache.set(key, null);
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
    addressCache.set(key, null);
    return null;
  }
}
