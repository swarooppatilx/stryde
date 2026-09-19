import type { ContractFunctionArgs, ContractFunctionName, TransactionReceipt } from 'viem';
import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';

type Contracts = ReturnType<typeof getContracts>;
type WritableName<K extends keyof Contracts> = ContractFunctionName<
  Contracts[K]['abi'],
  'nonpayable' | 'payable'
>;

export interface WriteCall<K extends keyof Contracts, F extends WritableName<K>> {
  functionName: F;
  args?: ContractFunctionArgs<Contracts[K]['abi'], 'nonpayable' | 'payable', F>;
  /** ETH sent with the call (payable functions only). */
  value?: bigint;
}

export interface WriteResult {
  txHash: `0x${string}`;
  confirmed: boolean;
  receipt: TransactionReceipt;
}

/** Sends one contract write from `wallet` and waits for it to be mined. */
export async function writeAndConfirm<K extends keyof Contracts, F extends WritableName<K>>(
  wallet: ReturnType<typeof getWalletClient>,
  contractName: K,
  call: WriteCall<K, F>
): Promise<WriteResult> {
  const account = wallet.account;
  if (!account) throw new Error('No wallet account found');

  const txHash = await wallet.writeContract({
    ...getContracts()[contractName],
    ...call,
    account,
    chain: getActiveConfig().chain,
  } as never);

  const receipt = await getPublicClient().waitForTransactionReceipt({ hash: txHash });
  return { txHash, confirmed: receipt.status === 'success', receipt };
}
