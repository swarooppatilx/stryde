import { services } from '@repo/shared';
import { useEffect, useState } from 'react';

/**
 * Resolves an address's ENS name against Sepolia (see packages/shared's
 * ens.ts — resolution is independent of the app's active ChainMode).
 * Returns null while resolving or when there's no name.
 */
export function useEnsName(address: `0x${string}` | string | null | undefined): string | null {
  const [ensName, setEnsName] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setEnsName(null);
      return;
    }
    let cancelled = false;
    services.ens.resolveEnsName(address as `0x${string}`).then((name) => {
      if (!cancelled) setEnsName(name);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return ensName;
}
