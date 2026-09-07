import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { useSmartWallets } from '@privy-io/expo/smart-wallets';
import type { ChainMode } from '@repo/shared';
import { useEffect, useRef, useState } from 'react';
import { type Chain, createWalletClient, custom, http, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, sepolia } from 'viem/chains';
import { anvil } from '@/config/privyChains';
import { ENV, getLocalRpcUrl, setCurrentUserId } from '@/constants/config';

// Anvil's well-known default account #0 — not a real secret, but guarded to
// local mode only so a misconfiguration can't reach it in a non-local build.
const ANVIL_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

function getAnvilAccount(mode: ChainMode) {
  if (mode !== 'local') {
    throw new Error('[useViemWallet] Anvil test account is only available in local chain mode');
  }
  return privateKeyToAccount(ANVIL_PRIVATE_KEY);
}

const CHAIN_MAP: Record<ChainMode, Chain> = {
  'ethereum-sepolia': sepolia,
  'base-sepolia': baseSepolia,
  local: anvil,
};

export function useViemWallet(mode: ChainMode = 'ethereum-sepolia'): {
  wallet: WalletClient | null;
  address: `0x${string}` | null;
  isLoading: boolean;
} {
  const { wallets } = useEmbeddedEthereumWallet();
  const { getClientForChain } = useSmartWallets();
  const [wallet, setWallet] = useState<WalletClient | null>(null);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const localInitRef = useRef(false);

  // Local mode: init once, never re-run (no Privy dependency)
  useEffect(() => {
    if (mode !== 'local') return;
    if (localInitRef.current) return;
    localInitRef.current = true;
    const anvilAccount = getAnvilAccount(mode);
    setWallet(
      createWalletClient({
        chain: anvil,
        transport: http(getLocalRpcUrl()),
        account: anvilAccount,
      })
    );
    setAddress(anvilAccount.address);
    setCurrentUserId(anvilAccount.address);
    setIsLoading(false);
  }, [mode]);

  // Remote mode: init when Privy wallets are available
  useEffect(() => {
    if (mode === 'local') return;
    let cancelled = false;

    async function init() {
      try {
        const chain = CHAIN_MAP[mode];
        const embeddedWallet = wallets?.[0];

        // Before login there's no embedded wallet yet — bail instead of
        // calling into Privy's smart-wallet client, whose function identity
        // isn't stable pre-auth. Without this check the effect (deps include
        // getClientForChain) re-fires on every render, each attempt throwing
        // "must be logged in", which starves the JS thread in a tight loop.
        if (!embeddedWallet) {
          setIsLoading(false);
          return;
        }

        if (ENV.USE_SMART_WALLET) {
          // Gasless path: a Privy smart account (ERC-4337), sponsored via
          // whatever paymaster policy is configured in the Privy Dashboard.
          const smartClient = await getClientForChain({ chainId: chain.id });
          if (!cancelled) {
            setWallet(smartClient as unknown as WalletClient);
            setAddress(smartClient.account.address);
            setCurrentUserId(smartClient.account.address);
          }
          return;
        }

        const walletAddress = embeddedWallet.address as `0x${string}`;
        const provider = await embeddedWallet.getProvider();

        const viemWallet = createWalletClient({
          chain,
          transport: custom(provider),
          account: walletAddress,
        });

        if (!cancelled) {
          setWallet(viemWallet);
          setAddress(walletAddress);
          setCurrentUserId(walletAddress);
        }
      } catch (error) {
        console.error('[useViemWallet] Failed to initialize:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [wallets, mode, getClientForChain]);

  return { wallet, address, isLoading };
}
