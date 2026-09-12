import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { useSmartWallets } from '@privy-io/expo/smart-wallets';
import type { ChainMode } from '@repo/shared';
import { useEffect, useRef, useState } from 'react';
import { type Chain, createWalletClient, custom, http, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, sepolia } from 'viem/chains';
import { anvil } from '@/config/privyChains';
import { ENV, getLocalRpcUrl, setCurrentUserId } from '@/constants/config';
import { setActiveWallet } from '@/services/wallet';

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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Right after login, Privy's SmartWalletsProvider does its own background
// handshake to provision the smart wallet server-side (ping the embedded
// wallet, get an init challenge, sign it, link it) before getClientForChain
// can succeed. Calling getClientForChain immediately races that handshake —
// it throws a generic "Could not create smart wallet client" error until the
// link completes, even with a fully-configured dashboard. Retry with backoff
// instead of surfacing that race as a hard failure.
const SMART_WALLET_CLIENT_RETRIES = 5;
const SMART_WALLET_CLIENT_RETRY_BASE_MS = 500;

async function getSmartWalletClientWithRetry(
  getClientForChain: ReturnType<typeof useSmartWallets>['getClientForChain'],
  chainId: number
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < SMART_WALLET_CLIENT_RETRIES; attempt++) {
    try {
      return await getClientForChain({ chainId });
    } catch (error) {
      lastError = error;
      if (attempt < SMART_WALLET_CLIENT_RETRIES - 1) {
        await delay(SMART_WALLET_CLIENT_RETRY_BASE_MS * 2 ** attempt);
      }
    }
  }
  throw lastError;
}

export function useViemWallet(mode: ChainMode = 'ethereum-sepolia'): {
  wallet: WalletClient | null;
  address: `0x${string}` | null;
  isLoading: boolean;
  walletError: string | null;
} {
  const { wallets } = useEmbeddedEthereumWallet();
  const { getClientForChain } = useSmartWallets();
  const [wallet, setWallet] = useState<WalletClient | null>(null);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);
  const localInitRef = useRef(false);

  // getClientForChain's function identity isn't stable across renders, so it
  // can't sit in the remote-mode effect's dependency array without re-running
  // (and re-throwing, e.g. on a smart-wallet-client init failure) every
  // render — the same starvation-loop class of bug the pre-login guard below
  // already exists to avoid. Read it via a ref instead so the effect only
  // re-runs when `wallets`/`mode` actually change.
  const getClientForChainRef = useRef(getClientForChain);
  getClientForChainRef.current = getClientForChain;

  // Local mode: init once, never re-run (no Privy dependency)
  useEffect(() => {
    if (mode !== 'local') return;
    if (localInitRef.current) return;
    localInitRef.current = true;
    const anvilAccount = getAnvilAccount(mode);
    const localWallet = createWalletClient({
      chain: anvil,
      transport: http(getLocalRpcUrl()),
      account: anvilAccount,
    });
    setWallet(localWallet);
    setAddress(anvilAccount.address);
    setActiveWallet(localWallet, anvilAccount.address);
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
        // calling into Privy's smart-wallet client. Without this check the
        // effect would re-run every time getClientForChain's identity
        // changes pre-auth, each attempt throwing "must be logged in", which
        // starves the JS thread in a tight loop.
        if (!embeddedWallet) {
          setIsLoading(false);
          return;
        }

        if (ENV.USE_SMART_WALLET) {
          try {
            // Gasless path: a Privy smart account (ERC-4337), sponsored via
            // whatever paymaster policy is configured in the Privy Dashboard.
            const smartClient = await getSmartWalletClientWithRetry(
              getClientForChainRef.current,
              chain.id
            );
            if (!cancelled) {
              setWallet(smartClient as unknown as WalletClient);
              setAddress(smartClient.account.address);
              setActiveWallet(smartClient as unknown as WalletClient, smartClient.account.address);
              setCurrentUserId(smartClient.account.address);
            }
            return;
          } catch (smartWalletError) {
            // Don't leave the user with no wallet at all if the smart-account
            // path is broken (misconfigured paymaster policy, Privy-side
            // outage, etc.) — fall back to the raw embedded wallet so writes
            // still work (paid in the wallet's own gas) instead of silently
            // stalling every screen that depends on an address existing.
            console.warn(
              '[useViemWallet] Smart wallet client unavailable, falling back to embedded wallet:',
              smartWalletError
            );
          }
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
          setActiveWallet(viemWallet, walletAddress);
          setCurrentUserId(walletAddress);
        }
      } catch (error) {
        console.error('[useViemWallet] Failed to initialize:', error);
        setWalletError(error instanceof Error ? error.message : 'Wallet initialization failed');
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
    // getClientForChain deliberately excluded — see getClientForChainRef above.
  }, [wallets, mode]);

  return { wallet, address, isLoading, walletError };
}
