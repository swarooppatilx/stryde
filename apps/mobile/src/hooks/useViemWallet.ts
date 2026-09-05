import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import type { ChainMode } from '@repo/shared';
import { useEffect, useRef, useState } from 'react';
import { type Chain, createWalletClient, custom, http, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, sepolia } from 'viem/chains';
import { anvil } from '@/config/privyChains';
import { getLocalRpcUrl, setCurrentUserId } from '@/constants/config';

const ANVIL_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
const ANVIL_ACCOUNT = privateKeyToAccount(ANVIL_PRIVATE_KEY);

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
  const [wallet, setWallet] = useState<WalletClient | null>(null);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const localInitRef = useRef(false);

  // Local mode: init once, never re-run (no Privy dependency)
  useEffect(() => {
    if (mode !== 'local') return;
    if (localInitRef.current) return;
    localInitRef.current = true;
    setWallet(
      createWalletClient({
        chain: anvil,
        transport: http(getLocalRpcUrl()),
        account: ANVIL_ACCOUNT,
      })
    );
    setAddress(ANVIL_ACCOUNT.address);
    setCurrentUserId(ANVIL_ACCOUNT.address);
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

        if (!embeddedWallet) {
          setIsLoading(false);
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
  }, [wallets, mode]);

  return { wallet, address, isLoading };
}
