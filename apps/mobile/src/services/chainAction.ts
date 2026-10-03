import type { WalletClient } from 'viem';

export interface TxLike {
  confirmed: boolean;
  queued?: boolean;
}

export interface TxLabels {
  pending?: string;
  success?: string;
}

export interface Optimistic {
  apply(): void;
  revert(): void;
}

type Transact = <T extends TxLike>(
  fn: () => Promise<T>,
  labels?: TxLabels,
  optimistic?: Optimistic
) => Promise<T | null>;

interface Deps {
  wallet: WalletClient | null;
  address: `0x${string}` | null;
  transact: Transact;
  notifyNoWallet(): void;
}

/** A chain write from a screen: needs a connected wallet, then goes through the transactor's feedback. */
export async function runChainAction<T extends TxLike>(
  { wallet, address, transact, notifyNoWallet }: Deps,
  write: (wallet: WalletClient, address: `0x${string}`) => Promise<T>,
  labels?: TxLabels,
  optimistic?: Optimistic
): Promise<T | null> {
  if (!wallet || !address) {
    notifyNoWallet();
    return null;
  }
  return transact(() => write(wallet, address), labels, optimistic);
}
