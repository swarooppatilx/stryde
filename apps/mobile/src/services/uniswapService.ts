import { services } from '@repo/shared';
import type { WalletClient } from 'viem';
import { apiFetch } from './strydeApi';

export interface PoolKey {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
}

export interface UniswapInfo {
  chainId: number;
  hook: `0x${string}`;
  poolKey: PoolKey;
  router: `0x${string}`;
  poolManager: `0x${string}`;
  quoter: `0x${string}`;
  tiers: Record<string, string>;
}

export interface FeeTier {
  tier: number;
  feePips: number;
  label: string;
}

export interface FeeInfo {
  wallet: string;
  active: boolean;
  sell: FeeTier;
  unverifiedSell: FeeTier;
}

const MAX_SQRT_PRICE_LIMIT = 1461446703485210103287273052203988822378723970342n - 1n;

const poolKeyComponents = [
  { name: 'currency0', type: 'address' },
  { name: 'currency1', type: 'address' },
  { name: 'fee', type: 'uint24' },
  { name: 'tickSpacing', type: 'int24' },
  { name: 'hooks', type: 'address' },
] as const;

const poolSwapTestAbi = [
  {
    type: 'function',
    name: 'swap',
    stateMutability: 'payable',
    inputs: [
      { name: 'key', type: 'tuple', components: poolKeyComponents },
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'zeroForOne', type: 'bool' },
          { name: 'amountSpecified', type: 'int256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
      {
        name: 'testSettings',
        type: 'tuple',
        components: [
          { name: 'takeClaims', type: 'bool' },
          { name: 'settleUsingBurn', type: 'bool' },
        ],
      },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [{ name: 'delta', type: 'int256' }],
  },
] as const;

const quoterAbi = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'poolKey', type: 'tuple', components: poolKeyComponents },
          { name: 'zeroForOne', type: 'bool' },
          { name: 'exactAmount', type: 'uint128' },
          { name: 'hookData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export function getUniswapInfo() {
  return apiFetch<UniswapInfo>('/uniswap/info');
}

export function getFeeInfo(wallet: string) {
  return apiFetch<FeeInfo>(`/uniswap/fee?wallet=${wallet}`);
}

export function feePipsToPercent(feePips: number): string {
  return `${(feePips / 10_000).toFixed(2)}%`;
}

export async function getStrdBalance(info: UniswapInfo, owner: `0x${string}`): Promise<bigint> {
  return services.client.getPublicClient().readContract({
    address: info.poolKey.currency1,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner],
  });
}

/** ETH out for selling `amountIn` STRD at the pool's unverified-seller fee. */
export async function quoteSellWithoutPass(info: UniswapInfo, amountIn: bigint): Promise<bigint> {
  const { result } = await services.client.getPublicClient().simulateContract({
    address: info.quoter,
    abi: quoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{ poolKey: info.poolKey, zeroForOne: false, exactAmount: amountIn, hookData: '0x' }],
  });
  return result[0];
}

/** Rescales a quote taken at one LP fee to another (exact for the fee part, ignores price impact drift). */
export function rescaleForFee(amountOut: bigint, fromFeePips: number, toFeePips: number): bigint {
  return (amountOut * BigInt(1_000_000 - toFeePips)) / BigInt(1_000_000 - fromFeePips);
}

/** Proves wallet ownership to the API and receives a single-use SweatPass for hookData. */
export async function requestFeePass(wallet: WalletClient, address: `0x${string}`): Promise<`0x${string}`> {
  const issuedAt = Date.now();
  const message = `Stryde fee pass\nwallet:${address.toLowerCase()}\nissued:${issuedAt}`;
  const signature = await wallet.signMessage({ account: wallet.account ?? address, message });
  const pass = await apiFetch<{ hookData: `0x${string}` }>('/uniswap/fee-pass', {
    method: 'POST',
    body: JSON.stringify({ wallet: address, issuedAt, signature }),
  });
  return pass.hookData;
}

/** Sells STRD for ETH through the SweatFeeHook pool. */
export async function sellStrd(
  wallet: WalletClient,
  address: `0x${string}`,
  info: UniswapInfo,
  amountIn: bigint,
  hookData: `0x${string}`
): Promise<{ confirmed: boolean; txHash: `0x${string}` }> {
  const client = services.client.getPublicClient();
  const chain = services.client.getActiveConfig().chain;
  const account = wallet.account ?? address;
  const strd = info.poolKey.currency1;

  const allowance = await client.readContract({
    address: strd,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address, info.router],
  });
  if (allowance < amountIn) {
    const approveHash = await wallet.writeContract({
      address: strd,
      abi: erc20Abi,
      functionName: 'approve',
      args: [info.router, amountIn],
      account,
      chain,
    });
    await client.waitForTransactionReceipt({ hash: approveHash });
  }

  const txHash = await wallet.writeContract({
    address: info.router,
    abi: poolSwapTestAbi,
    functionName: 'swap',
    args: [
      info.poolKey,
      { zeroForOne: false, amountSpecified: -amountIn, sqrtPriceLimitX96: MAX_SQRT_PRICE_LIMIT },
      { takeClaims: false, settleUsingBurn: false },
      hookData,
    ],
    account,
    chain,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  return { confirmed: receipt.status === 'success', txHash };
}
