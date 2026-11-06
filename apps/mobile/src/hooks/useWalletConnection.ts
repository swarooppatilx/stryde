import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { useSmartWallets } from '@privy-io/expo/smart-wallets';
import { type ChainMode, services } from '@repo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Chain, WalletClient } from 'viem';
import { baseSepolia, sepolia } from 'viem/chains';
import { anvil } from '@/config/privyChains';
import { clearCurrentUserId, ENV, getLocalRpcUrl, setCurrentUserId } from '@/constants/config';
import { DEV_TOOLS } from '@/constants/devTools';
import { useAuth } from '@/hooks/useAuth';
import { getPlatform } from '@/platform';
import { setActiveWallet } from '@/services/wallet';
import { connectRemoteWallet } from '@/services/walletConnection';
import {
  lockFallbackIdentity,
  rememberedWalletKind,
  rememberWalletKind,
} from '@/services/walletIdentity';
import { logger } from '@/utils/logger';
import { walletRetryDelayMs } from '@/utils/walletRetry';

const CHAIN_MAP: Record<ChainMode, Chain> = {
  'ethereum-sepolia': sepolia,
  'base-sepolia': baseSepolia,
  local: anvil,
};

export interface WalletState {
  wallet: WalletClient | null;
  address: `0x${string}` | null;
  isLoading: boolean;
  walletError: string | null;
  /** True from the first failed start until the wallet connects: unlike `walletError` it stays set while a retry is running, so screens can keep saying "not connected" instead of flickering back to a spinner. */
  walletFailed: boolean;
  /** 'smart' = gas-free; 'embedded' = pays its own gas (the smart wallet couldn't be used). */
  walletKind: 'smart' | 'embedded' | null;
  /** Tries to connect again after a failure (e.g. the gas-free wallet was unreachable). */
  retry: () => void;
}

/** Connects the wallet. Mount once, in `WalletProvider`; screens read it with `useViemWallet()`. */
export function useWalletConnection(mode: ChainMode = 'ethereum-sepolia'): WalletState {
  const { wallets } = useEmbeddedEthereumWallet();
  const { getClientForChain } = useSmartWallets();
  const { user, isReady } = useAuth();
  const privyUserId = user?.kind === 'privy' ? user.id : undefined;
  const [wallet, setWallet] = useState<WalletClient | null>(null);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletKind, setWalletKind] = useState<'smart' | 'embedded' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [walletFailed, setWalletFailed] = useState(false);

  // getClientForChain's identity changes every render; reading it via a ref keeps it out of the effect deps, which would otherwise re-run and re-throw (a starvation loop, see the pre-login guard below).
  const getClientForChainRef = useRef(getClientForChain);
  getClientForChainRef.current = getClientForChain;

  // Local mode: no Privy dependency. The wallet follows the signed-in persona, so switching persona switches athlete.
  const localPersonaId = user?.kind === 'dev' ? user.id : null;
  useEffect(() => {
    if (mode !== 'local') return;
    // `DEV_TOOLS.enabled` is fixed when the app is built: a production bundle drops this branch and the dev wallet.
    if (!DEV_TOOLS.enabled) {
      setWalletError('Local chain mode is only available in development builds');
      setIsLoading(false);
      return;
    }
    const { createLocalDevWallet } =
      require('@/services/localDevWallet') as typeof import('@/services/localDevWallet');
    const { PERSONAS } =
      require('@/backends/auth/personas') as typeof import('@/backends/auth/personas');
    const slot = Math.max(
      0,
      PERSONAS.findIndex((p) => `dev:${p.id}` === localPersonaId)
    );
    const local = createLocalDevWallet(getLocalRpcUrl(), slot);
    setWallet(local.wallet);
    setAddress(local.address);
    setActiveWallet(local.wallet, local.address);
    setCurrentUserId(local.address);
    setIsLoading(false);
  }, [mode, localPersonaId]);

  // On logout forget the last user's wallet and identity, or the write queue keeps signing as the previous account.
  useEffect(() => {
    if (mode === 'local' || !isReady || user !== null) return;
    setWallet(null);
    setAddress(null);
    setWalletKind(null);
    setActiveWallet(null, null);
    clearCurrentUserId();
  }, [mode, isReady, user]);

  // Remote mode: init when Privy wallets are available
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the connection when retry() is called
  useEffect(() => {
    if (mode === 'local') return;
    let cancelled = false;

    async function init() {
      try {
        const embeddedWallet = wallets?.[0];

        // No embedded wallet before login; bail, or each identity change re-throws "must be logged in" and starves the JS thread.
        if (!embeddedWallet) {
          setIsLoading(false);
          return;
        }

        // A user who has used the gas-free wallet keeps it: the embedded wallet is a different
        // address (a different onchain identity), so it must never silently replace it.
        const storage = getPlatform().storage;
        const lockedKind = privyUserId ? await rememberedWalletKind(storage, privyUserId) : null;
        if (!cancelled) setWalletError(null);

        const connection = await connectRemoteWallet({
          chain: CHAIN_MAP[mode],
          lockedKind,
          embedded: embeddedWallet,
          // Gasless path: a Privy smart account (ERC-4337) sponsored by the paymaster policy. Each attempt reads the latest getClientForChain; a copy captured before the wallet connected would fail every retry.
          getSmartClient: ENV.USE_SMART_WALLET
            ? (chainId) => getClientForChainRef.current({ chainId })
            : null,
          onFallback: (error) =>
            logger.warn(
              '[useWalletConnection] Smart wallet client unavailable, falling back to embedded wallet:',
              error
            ),
        });

        if (privyUserId && connection.kind === 'smart' && lockedKind !== 'smart') {
          await rememberWalletKind(storage, privyUserId, 'smart');
        }

        if (privyUserId && connection.kind === 'embedded' && lockedKind === null) {
          await lockFallbackIdentity(storage, privyUserId, connection.address, (a) =>
            services.profile.isRegistered(a)
          );
        }

        if (!cancelled) {
          setWallet(connection.wallet);
          setAddress(connection.address);
          setWalletKind(connection.kind);
          setActiveWallet(connection.wallet, connection.address);
          setCurrentUserId(connection.address);
          setWalletFailed(false);
        }
      } catch (error) {
        logger.error('[useWalletConnection] Failed to initialize:', error, (error as Error)?.cause);
        setWalletError(error instanceof Error ? error.message : 'Wallet initialization failed');
        setWalletFailed(true);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
    // getClientForChain deliberately excluded — see getClientForChainRef above.
  }, [wallets, mode, attempt, privyUserId]);

  const retry = useCallback(() => {
    setIsLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  // The gas-free wallet often fails right after a cold start and works a minute later, so keep trying
  // quietly with growing pauses instead of leaving the athlete stuck until the app is reopened.
  const failures = useRef(0);
  useEffect(() => {
    // Only a connected wallet resets the count: the error also clears when each retry starts.
    if (!walletFailed) failures.current = 0;
    if (!walletError) return;
    failures.current += 1;
    const timer = setTimeout(retry, walletRetryDelayMs(failures.current));
    return () => clearTimeout(timer);
  }, [walletError, walletFailed, retry]);

  return { wallet, address, isLoading, walletError, walletFailed, walletKind, retry };
}
