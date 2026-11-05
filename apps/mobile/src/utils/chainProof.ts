type ProofFields = { activityId?: string; onchainActivityId?: string; txHash?: string };

export type ChainProof = { state: 'onchain'; txHash: string | undefined } | { state: 'local' };

/** Whether the chain holds this activity: it was read back from it, or the local recording was confirmed. */
export function chainProof(activity: ProofFields): ChainProof {
  if (activity.activityId != null || activity.onchainActivityId != null) {
    return { state: 'onchain', txHash: activity.txHash };
  }
  return { state: 'local' };
}

/** The block explorer page for a transaction, or null when there is no explorer or no hash. */
export function explorerTxUrl(explorerBase: string | undefined, txHash: string | undefined) {
  if (!explorerBase || !txHash) return null;
  return `${explorerBase.replace(/\/+$/, '')}/tx/${txHash}`;
}

/** The block explorer page for an address (what it holds), or null when there is no explorer or address. */
export function explorerAddressUrl(explorerBase: string | undefined, address: string | null) {
  if (!explorerBase || !address) return null;
  return `${explorerBase.replace(/\/+$/, '')}/address/${address}`;
}
