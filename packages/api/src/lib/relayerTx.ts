import { type Abi, TransactionNotFoundError, WaitForTransactionReceiptTimeoutError } from 'viem';
import { getRelayChainConfig } from './chainConfig.js';
import { RELAY_ABIS } from './relayAbis.js';
import {
  classifyResendError,
  GasPriceTooHighError,
  isDefiniteSendRefusal,
  ReceiptTimeoutError,
} from './relayErrors.js';
import { getRelayerPublicClient, getRelayerWallet } from './relayer.js';
import { createSerialQueue } from './serialQueue.js';

export interface RelayCall {
  contract: string;
  functionName: string;
  args: readonly unknown[];
}

export interface RelayResult {
  /** The transaction that was mined: the replacement's hash when a fee bump won. */
  hash: `0x${string}`;
  confirmed: boolean;
  /** True when a fee-bumped resend (not the first send) is the one that mined. */
  replaced: boolean;
}

/** Geth-style nodes only accept a replacement that pays at least 10% more; 12.5% leaves margin. */
const BUMP_NUMERATOR = 1125n;
const BUMP_DENOMINATOR = 1000n;
const MIN_BUMP_NUMERATOR = 1100n;
export const MAX_FEE_BUMPS = 2;
/** Per attempt. The client gives up after 20 s and replays, so waiting far longer buys little. */
export const DEFAULT_RECEIPT_TIMEOUT_MS = 30_000;
/** Hard ceiling for one relay, sends included, so a request always ends inside a serverless limit. */
export const DEFAULT_MAX_TOTAL_MS = 100_000;

type Fees = { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | { gasPrice: bigint };

interface SentTransaction {
  nonce: number;
  gas: bigint;
  value: bigint;
  maxFeePerGas?: bigint | null;
  maxPriorityFeePerGas?: bigint | null;
  gasPrice?: bigint | null;
}

interface RelayPublicClient {
  simulateContract(params: never): Promise<{ request: unknown }>;
  estimateFeesPerGas(): Promise<{ maxFeePerGas?: bigint | null }>;
  getTransaction(params: { hash: `0x${string}` }): Promise<SentTransaction>;
  /** Rejects with viem's WaitForTransactionReceiptTimeoutError once `timeout` ms pass. */
  waitForTransactionReceipt(params: {
    hash: `0x${string}`;
    timeout?: number;
  }): Promise<{ status: string; transactionHash: `0x${string}` }>;
}

interface RelayWallet {
  account?: { address: `0x${string}` };
  writeContract(request: never): Promise<`0x${string}`>;
}

export interface RelayTxDeps {
  publicClient: RelayPublicClient;
  wallet: RelayWallet;
  resolveContract(name: string): { address: `0x${string}`; abi: Abi };
  /** Refuse to send while the network fee is above this (wei); no cap when undefined. */
  maxFeePerGas: bigint | undefined;
  /** How long to wait for a receipt before bumping the fee; defaults to 30 s. */
  receiptTimeoutMs?: number;
  /** Longest a single relay may take from first send to giving up; defaults to 100 s. */
  maxTotalMs?: number;
  /** Clock in ms; injectable so tests need no real waiting. */
  now?: () => number;
}

/** Raises a fee by 12.5%, held to the cap; null when the cap leaves less than the 10% a replacement needs. */
function bumpFee(current: bigint, cap: bigint | undefined): bigint | null {
  const bumped = (current * BUMP_NUMERATOR + BUMP_DENOMINATOR - 1n) / BUMP_DENOMINATOR;
  const next = cap !== undefined && bumped > cap ? cap : bumped;
  const floor = (current * MIN_BUMP_NUMERATOR + BUMP_DENOMINATOR - 1n) / BUMP_DENOMINATOR;
  return next >= floor ? next : null;
}

function feesOf(tx: SentTransaction): Fees {
  if (tx.maxFeePerGas != null) {
    return { maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? 0n };
  }
  if (tx.gasPrice != null) return { gasPrice: tx.gasPrice };
  throw new Error('[relayer] sent transaction reports no fee');
}

function bumpFees(fees: Fees, cap: bigint | undefined): Fees | null {
  if ('gasPrice' in fees) {
    const gasPrice = bumpFee(fees.gasPrice, cap);
    return gasPrice === null ? null : { gasPrice };
  }
  const maxFeePerGas = bumpFee(fees.maxFeePerGas, cap);
  if (maxFeePerGas === null) return null;
  // A tip above the fee cap is invalid, so the tip follows the cap down when it is clamped.
  const tip =
    fees.maxPriorityFeePerGas === 0n ? 0n : bumpFee(fees.maxPriorityFeePerGas, maxFeePerGas);
  if (tip === null) return null;
  return { maxFeePerGas, maxPriorityFeePerGas: tip };
}

/**
 * Builds the relayer's single write path: simulate (a revert costs nothing), check the fee
 * cap, send one transaction at a time so nonces never collide, then wait for the receipt.
 * Because the account's nonces are sequential, one transaction stuck in the pool holds up
 * every later one; if no receipt arrives in time the same call is re-sent at the same nonce
 * with a higher fee, up to MAX_FEE_BUMPS times and never above the cap.
 */
export function createRelayTx(deps: RelayTxDeps) {
  const sendSerially = createSerialQueue();
  const receiptTimeoutMs = deps.receiptTimeoutMs ?? DEFAULT_RECEIPT_TIMEOUT_MS;

  const maxTotalMs = deps.maxTotalMs ?? DEFAULT_MAX_TOTAL_MS;
  const now = deps.now ?? Date.now;

  /** Resolves with the first of the given transactions to be mined; null when none is by the deadline. */
  async function firstMined(hashes: readonly `0x${string}`[], timeout: number) {
    try {
      // viem answers for the original hash with the replacement's receipt if that one mined,
      // so the receipt's own hash, not the one asked about, says which transaction won.
      return await Promise.any(
        hashes.map((hash) => deps.publicClient.waitForTransactionReceipt({ hash, timeout }))
      );
    } catch (error) {
      const failures = error instanceof AggregateError ? (error.errors as unknown[]) : [error];
      const real = failures.find((e) => !(e instanceof WaitForTransactionReceiptTimeoutError));
      if (real) throw real;
      return null;
    }
  }

  return async function relayTx(call: RelayCall): Promise<RelayResult> {
    const { account } = deps.wallet;
    if (!account) throw new Error('[relayer] wallet has no account');
    const contract = deps.resolveContract(call.contract);
    const startedAt = now();

    const sent = await sendSerially(async () => {
      const { request } = await deps.publicClient.simulateContract({
        ...contract,
        functionName: call.functionName,
        args: call.args,
        account,
      } as never);
      if (deps.maxFeePerGas !== undefined) {
        const { maxFeePerGas } = await deps.publicClient.estimateFeesPerGas();
        if (maxFeePerGas != null && maxFeePerGas > deps.maxFeePerGas) {
          throw new GasPriceTooHighError();
        }
      }
      try {
        return { request, hash: await deps.wallet.writeContract(request as never) };
      } catch (error) {
        // An unclear failure (timeout, lost reply) may have reached the pool: the caller must
        // treat the write as possibly happening, not as not having happened.
        if (isDefiniteSendRefusal(error)) throw error;
        throw new ReceiptTimeoutError(error);
      }
    });

    // From here the transaction is in the network and may still mine. Every failure is
    // reported as ReceiptTimeoutError (cause attached) so callers know not to treat the
    // write as not having happened.
    const original = sent.hash;
    const hashes = [original];
    let resend: { nonce: number; gas: bigint; value: bigint; fees: Fees } | null = null;
    try {
      for (let bumps = 0; ; bumps++) {
        const remaining = startedAt + maxTotalMs - now();
        if (remaining <= 0) throw new ReceiptTimeoutError();
        const mined = await firstMined(hashes, Math.min(receiptTimeoutMs, remaining));
        if (mined) {
          return {
            hash: mined.transactionHash,
            confirmed: mined.status === 'success',
            replaced: mined.transactionHash !== original,
          };
        }
        if (bumps === MAX_FEE_BUMPS || startedAt + maxTotalMs - now() <= 0) {
          throw new ReceiptTimeoutError();
        }

        // The queue keeps the resend from interleaving with another send; a failure here
        // releases it like any other job, so later writes are never stuck behind this one.
        const replacement = await sendSerially(async () => {
          if (!resend) {
            let tx: SentTransaction;
            try {
              tx = await deps.publicClient.getTransaction({ hash: original });
            } catch (error) {
              // Not found yet (lagging RPC) or dropped: keep waiting on what was sent.
              if (error instanceof TransactionNotFoundError) return null;
              throw error;
            }
            resend = { nonce: tx.nonce, gas: tx.gas, value: tx.value, fees: feesOf(tx) };
          }
          const fees = bumpFees(resend.fees, deps.maxFeePerGas);
          if (!fees) throw new GasPriceTooHighError();
          // Remember the attempt even if the node refuses it, so the next bump starts higher.
          resend.fees = fees;
          try {
            // Gas and value are pinned to the original: letting the wallet re-estimate would
            // revert with the contract's own error if the original has mined meanwhile.
            return await deps.wallet.writeContract({
              ...(sent.request as object),
              nonce: resend.nonce,
              gas: resend.gas,
              value: resend.value,
              ...fees,
            } as never);
          } catch (error) {
            // Nonce too low / already known: the original moved on, so just keep waiting for
            // it. Underpriced: our bump was too small, the next round bumps again.
            if (classifyResendError(error)) return null;
            throw error;
          }
        });
        if (replacement) hashes.push(replacement);
      }
    } catch (error) {
      throw error instanceof ReceiptTimeoutError ? error : new ReceiptTimeoutError(error);
    }
  };
}

function resolveContract(name: string): { address: `0x${string}`; abi: Abi } {
  const address = getRelayChainConfig().contracts[name];
  const abi = RELAY_ABIS[name as keyof typeof RELAY_ABIS] as Abi | undefined;
  if (!address || !abi) throw new Error(`[relay] Unknown contract: ${name}`);
  return { address, abi };
}

function maxFeeFromEnv(): bigint | undefined {
  const gwei = Number(process.env.RELAYER_MAX_FEE_GWEI);
  return Number.isFinite(gwei) && gwei > 0 ? BigInt(Math.round(gwei * 1e9)) : undefined;
}

function receiptTimeoutFromEnv(): number {
  const ms = Number(process.env.RELAYER_RECEIPT_TIMEOUT_MS);
  return Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_RECEIPT_TIMEOUT_MS;
}

let sharedRelayTx: ReturnType<typeof createRelayTx> | null = null;

/** The relayer's configured write path; one instance per process so sends stay serialized. */
export function relayTx(call: RelayCall): Promise<RelayResult> {
  sharedRelayTx ??= createRelayTx({
    publicClient: getRelayerPublicClient(),
    wallet: getRelayerWallet(),
    resolveContract,
    get maxFeePerGas() {
      return maxFeeFromEnv();
    },
    get receiptTimeoutMs() {
      return receiptTimeoutFromEnv();
    },
  });
  return sharedRelayTx(call);
}
