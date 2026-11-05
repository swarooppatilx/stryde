import { services } from '@repo/shared';
import { useEffect, useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  type EnsNameProblem,
  type EnsResolvers,
  ensNameProblem,
  looksLikeEnsName,
  verifyEnsRoundTrip,
} from '@/utils/counterpartyChecks';

const TYPING_PAUSE_MS = 500;

const resolvers: EnsResolvers = {
  forward: (name) => services.ens.resolveEnsAddress(name),
  reverse: (address) => services.ens.resolveEnsName(address),
};

/** Whether `name` and `address` point at each other; false until the background lookup lands, so it never holds up the form or marks early. */
export function useEnsVerified(name: string | null, address: string | null | undefined): boolean {
  const [verified, setVerified] = useState<{ key: string } | null>(null);
  const key = name && address ? `${name}|${address}` : null;
  useEffect(() => {
    if (!key || !name || !address) return;
    let cancelled = false;
    void verifyEnsRoundTrip(name, address, resolvers).then((ok) => {
      if (!cancelled && ok) setVerified({ key });
    });
    return () => {
      cancelled = true;
    };
  }, [key, name, address]);
  // Keyed, so a result for an earlier name can never mark a later one.
  return key !== null && verified?.key === key;
}

export type TypedEns =
  | { status: 'none' }
  | { status: 'rejected'; problem: EnsNameProblem }
  | { status: 'resolving' }
  | { status: 'unknown' }
  | { status: 'found'; name: string; address: `0x${string}`; verified: boolean };

/** A name typed where an address goes: refused at once if it can be confused, otherwise resolved after a pause. */
export function useTypedEns(input: string): TypedEns {
  const name = looksLikeEnsName(input) ? input.trim() : null;
  const pending = useDebouncedValue(name, TYPING_PAUSE_MS);
  const problem = name ? ensNameProblem(name) : null;
  const [resolved, setResolved] = useState<{
    name: string;
    address: `0x${string}` | null;
    verified: boolean;
  } | null>(null);

  useEffect(() => {
    if (!pending || ensNameProblem(pending)) return;
    let cancelled = false;
    void (async () => {
      const address = await resolvers.forward(pending).catch(() => null);
      const verified = address ? await verifyEnsRoundTrip(pending, address, resolvers) : false;
      if (!cancelled) setResolved({ name: pending, address, verified });
    })();
    return () => {
      cancelled = true;
    };
  }, [pending]);

  if (!name) return { status: 'none' };
  if (problem) return { status: 'rejected', problem };
  if (pending !== name || resolved?.name !== name) return { status: 'resolving' };
  if (!resolved.address) return { status: 'unknown' };
  return { status: 'found', name, address: resolved.address, verified: resolved.verified };
}
