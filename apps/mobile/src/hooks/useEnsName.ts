import { services } from '@repo/shared';
import { useEffect, useState } from 'react';

/** Resolves an address's ENS name on Sepolia regardless of the active ChainMode; null while resolving or when none. */
export function useEnsName(address: `0x${string}` | string | null | undefined): string | null {
  // Keyed by address, so a name found for one address is never shown for the next one.
  const [found, setFound] = useState<{ address: string; name: string | null } | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    services.ens
      .resolveEnsName(address as `0x${string}`)
      .then((name) => {
        if (!cancelled) setFound({ address, name });
      })
      // A failed lookup just means no name to show.
      .catch(() => {
        if (!cancelled) setFound({ address, name: null });
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return address && found?.address === address ? found.name : null;
}

/** The avatar record of an ENS name, or null while resolving, when there is none, or without a name. */
export function useEnsAvatar(name: string | null): string | null {
  const [found, setFound] = useState<{ name: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    services.ens
      .resolveEnsAvatar(name)
      .then((url) => {
        if (!cancelled) setFound({ name, url });
      })
      .catch(() => {
        if (!cancelled) setFound({ name, url: null });
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  return name && found?.name === name ? found.url : null;
}
