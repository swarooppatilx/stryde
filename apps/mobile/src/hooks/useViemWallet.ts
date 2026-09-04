import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import type { ChainMode } from '@repo/shared';
import { useEffect, useState } from 'react';
import { createWalletClient, custom, http, type WalletClient } from 'viem';
import { baseSepolia, sepolia } from 'viem/chains';
import { anvil } from '@/config/privyChains';
import { getLocalRpcUrl, setCurrentUserId } from '@/constants/config';

const ANVIL_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;
const ANVIL_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

const CHAIN_MAP: Record<ChainMode, typeof sepolia> = {
  'ethereum-sepolia': sepolia,
  'base-sepolia': baseSepolia,
  local: anvil,
};

function createLocalWallet(): WalletClient {
  return createWalletClient({
    chain: anvil,
    transport: http(getLocalRpcUrl()),
    account: ANVIL_PRIVATE_KEY,
  });
}

export function useViemWallet(mode: ChainMode = 'ethereum-sepolia'): {
  wallet: WalletClient | null;
  address: `0x${string}` | null;
  isLoading: boolean;
} {
  const { wallets } = useEmbeddedEthereumWallet();
  const [wallet, setWallet] = useState<WalletClient | null>(null);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        if (mode === 'local') {
          if (!cancelled) {
            setWallet(createLocalWallet());
            setAddress(ANVIL_ACCOUNT);
            setCurrentUserId(ANVIL_ACCOUNT);
          }
          return;
        }

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
