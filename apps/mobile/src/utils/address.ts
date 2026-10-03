/** Wallet ids arrive checksummed from the wallet and lowercased from the chain index. */
export function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}
