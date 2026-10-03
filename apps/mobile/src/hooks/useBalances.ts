import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { readBalances } from '@/backends/balanceSource';

/** ETH and STRD balances of `address`, reloaded whenever the screen gains focus. */
export function useBalances(address: `0x${string}` | null) {
  const [eth, setEth] = useState<bigint | null>(null);
  const [strd, setStrd] = useState<bigint | null>(null);

  const load = useCallback(async (target: `0x${string}`, isCancelled: () => boolean) => {
    const next = await readBalances(target);
    if (isCancelled()) return;
    setEth(next.eth);
    setStrd(next.strd);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!address) return;
      let cancelled = false;
      void load(address, () => cancelled);
      return () => {
        cancelled = true;
      };
    }, [address, load])
  );

  const refresh = useCallback(async () => {
    if (address) await load(address, () => false);
  }, [address, load]);

  return { eth, strd, refresh };
}
