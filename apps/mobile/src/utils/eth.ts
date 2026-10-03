import { formatEther, formatUnits, parseEther } from 'viem';

const DECIMAL_PATTERN = /^(\d*)\.?(\d*)$/;
const WEI_DECIMALS = 18;

/** What a person typed as an ETH amount, in wei; null for anything that isn't a plain decimal number. */
export function parseEthAmount(input: string): bigint | null {
  // Many keyboards only offer a comma, like the distance field accepts.
  const trimmed = input.trim().replace(',', '.');
  const match = DECIMAL_PATTERN.exec(trimmed);
  if (!match || trimmed === '.' || trimmed === '') return null;
  if ((match[2] ?? '').length > WEI_DECIMALS) return null;
  return parseEther(trimmed);
}

/** An ETH balance for a label: four decimals, then the unit. */
export function formatEthAmount(wei: bigint): string {
  return `${Number(formatEther(wei)).toFixed(4)} ETH`;
}

/** Wei → "1.23 X"; a blank symbol drops the separator, so plain-language labels can follow. */
export function formatTokenAmount(wei: bigint, symbol: string): string {
  const amount = Number(formatUnits(wei, 18)).toFixed(2);
  return symbol ? `${amount} ${symbol}` : amount;
}
