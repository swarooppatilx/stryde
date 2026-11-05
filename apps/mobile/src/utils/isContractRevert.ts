const MAX_DEPTH = 8;

/**
 * The contract error a failed call reverted with: its name (e.g. `DuplicateComment`), an empty
 * string for a revert with no named error, or null when it was not a revert at all (the network
 * failing, a timeout, ...).
 */
export function revertName(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_DEPTH && current instanceof Error; depth++) {
    if (current.name === 'ContractFunctionRevertedError') {
      const data = (current as { data?: { errorName?: unknown } }).data;
      return typeof data?.errorName === 'string' ? data.errorName : '';
    }
    current = current.cause;
  }
  return null;
}

/** Whether a failed contract call was a revert, i.e. the contract said no for good rather than the network failing. */
export function isContractRevert(error: unknown): boolean {
  return revertName(error) !== null;
}
