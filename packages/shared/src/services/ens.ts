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

const nameCache = new Map<string, string | null>();
const addressCache = new Map<string, `0x${string}` | null>();

export async function resolveEnsName(address: `0x${string}`): Promise<string | null> {
  const key = address.toLowerCase();
  if (nameCache.has(key)) return nameCache.get(key) ?? null;

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
  if (addressCache.has(key)) return addressCache.get(key) ?? null;

  try {
    const address = await ensClient.getEnsAddress({ name });
    addressCache.set(key, address);
    return address;
  } catch {
    addressCache.set(key, null);
    return null;
  }
}
