import { useCallback } from 'react';
import type { WalletClient } from 'viem';
import { COPY } from '@/constants/copy';
import {
  type Optimistic,
  runChainAction,
  type TxLabels,
  type TxLike,
} from '@/services/chainAction';
import { Toast } from '@/utils/toast';
import { useTransactor } from './useTransactor';
import { useViemWallet } from './useViemWallet';

/** The connected wallet plus `run(write)`, which reports a missing wallet instead of ignoring the tap. */
export function useChainAction() {
  const { wallet, address } = useViemWallet();
  const { transact } = useTransactor();

  const run = useCallback(
    <T extends TxLike>(
      write: (wallet: WalletClient, address: `0x${string}`) => Promise<T>,
      labels?: TxLabels,
      optimistic?: Optimistic
    ) =>
      runChainAction(
        {
          wallet,
          address,
          transact,
          notifyNoWallet: () => Toast.info(COPY.accountConnecting, 2),
        },
        write,
        labels,
        optimistic
      ),
    [wallet, address, transact]
  );

  return { wallet, address, run };
}
