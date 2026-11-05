import { createWalletClient, http, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil } from '@/config/privyChains';

// Anvil's published default accounts, funded on every anvil and worthless anywhere else. Only loaded from
// developer-tools code paths (`DEV_TOOLS.enabled`) so release bundles never contain them.
// #0 is the key the local API relays with (`dev-local.sh`), so no athlete signs as it: an athlete that is also
// the relayer would hide every bug in the sponsored-write path.
const ANVIL_PRIVATE_KEYS = [
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
] as const;

/** A stable account for each developer persona, so two personas are two different athletes on the chain. */
export function createLocalDevWallet(
  rpcUrl: string,
  slot = 0
): {
  wallet: WalletClient;
  address: `0x${string}`;
} {
  const key = ANVIL_PRIVATE_KEYS[slot % ANVIL_PRIVATE_KEYS.length] as `0x${string}`;
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ chain: anvil, transport: http(rpcUrl), account });
  return { wallet, address: account.address };
}
