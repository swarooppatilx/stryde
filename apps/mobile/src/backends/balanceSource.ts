import { services } from '@repo/shared';
import { logger } from '@/utils/logger';

export interface Balances {
  eth: bigint | null;
  strd: bigint | null;
}

export type BalanceReader = (address: `0x${string}`) => Promise<Balances>;

const readFailed = (token: string) => (error: unknown) => {
  logger.warn(`[balances] Could not read ${token} balance`, error);
  return null;
};

const readFromChain: BalanceReader = async (address) => {
  const [eth, strd] = await Promise.all([
    services.client.getBalance(address).catch(readFailed('ETH')),
    services.moveToEarnToken.getTokenBalance(address).catch(readFailed('STRD')),
  ]);
  return { eth, strd };
};

let reader: BalanceReader = readFromChain;

/** A profile with no chain to read (the Sandbox) registers its own source; null goes back to the chain. */
export function setBalanceReader(next: BalanceReader | null): void {
  reader = next ?? readFromChain;
}

export function readBalances(address: `0x${string}`): Promise<Balances> {
  return reader(address);
}
