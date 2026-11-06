import type { Hex } from 'viem';
import { LOG_WINDOW_BLOCKS } from './chainIndex.js';
import { type MirrorEvent, toMirrorEvent } from './mirrorEvents.js';
import { compare } from './order.js';

/** Blocks held back from the head: a block this young can still be replaced by a reorg. */
export const CONFIRMATIONS = 2;
/** How far a detected reorg rewinds; Sepolia reorgs are a few blocks deep, so this is generous. */
export const REWIND_BLOCKS = 64;
/** Events written in one Arkiv transaction (about 0.00015 tGLM each); a block's events are never split. */
export const BATCH_EVENTS = 20;
/** With no events to write, the checkpoint only moves once this many blocks would otherwise be re-read. */
const IDLE_CHECKPOINT_GAP = 1_000n;

/** A decoded log from one of the mirrored contracts. */
export interface RawLog {
  name: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  logIndex: number;
}

/** A mirrored event plus the timestamp of its block. */
export interface StoredEvent extends MirrorEvent {
  ts: number;
}

/** The newest block the mirror has answered for, and that block's hash at the time. */
export interface Checkpoint {
  block: bigint;
  hash: Hex;
}

export interface MirrorSource {
  head(): Promise<{ number: bigint; hash: Hex }>;
  /** The hash of a block as the chain has it now; null for a block beyond the head. */
  hashAt(block: bigint): Promise<Hex | null>;
  events(from: bigint, to: bigint): Promise<RawLog[]>;
  timestampAt(block: bigint): Promise<number>;
}

export interface MirrorStore {
  checkpoint(): Promise<Checkpoint | null>;
  /** Writes the events and the new checkpoint together: either both land or neither does. */
  write(batch: { events: StoredEvent[]; checkpoint: Checkpoint }): Promise<void>;
  /** Deletes every event after `block`; returns how many. */
  rewindTo(block: bigint): Promise<number>;
  setCheckpoint(checkpoint: Checkpoint): Promise<void>;
}

export interface MirrorOptions {
  /** The block the contracts were deployed in: nothing before it is worth reading. */
  deployBlock: bigint;
  windowBlocks?: bigint;
}

export interface MirrorResult {
  from: bigint;
  to: bigint;
  written: number;
  reorged: boolean;
}

const ZERO_HASH = `0x${'00'.repeat(32)}` as Hex;

/**
 * Brings the Arkiv mirror up to the chain head (minus the confirmation lag). Safe to run at any time
 * and from any number of attempts: events are only ever appended after the checkpoint, anything beyond
 * the checkpoint is removed before reading on (a write whose outcome was never learned must not double
 * up), and a checkpoint whose block hash no longer matches the chain rewinds before it continues.
 */
export async function syncMirror(
  source: MirrorSource,
  store: MirrorStore,
  { deployBlock, windowBlocks = LOG_WINDOW_BLOCKS }: MirrorOptions
): Promise<MirrorResult> {
  const head = await source.head();
  const target = head.number - BigInt(CONFIRMATIONS);
  let checkpoint = await store.checkpoint();
  let reorged = false;

  if (checkpoint) {
    const onChain = await source.hashAt(checkpoint.block);
    if (onChain === checkpoint.hash) {
      await store.rewindTo(checkpoint.block);
    } else {
      reorged = true;
      const rewindTo = maxBigInt(deployBlock - 1n, checkpoint.block - BigInt(REWIND_BLOCKS));
      await store.rewindTo(rewindTo);
      checkpoint = { block: rewindTo, hash: (await source.hashAt(rewindTo)) ?? ZERO_HASH };
      await store.setCheckpoint(checkpoint);
    }
  }

  const from = checkpoint ? checkpoint.block + 1n : deployBlock;
  if (from > target) return { from, to: target, written: 0, reorged };

  const logs: RawLog[] = [];
  for (let start = from; start <= target; start += windowBlocks) {
    const end = start + windowBlocks - 1n;
    logs.push(...(await source.events(start, end > target ? target : end)));
  }
  logs.sort((a, b) => compare(a.blockNumber, b.blockNumber) || a.logIndex - b.logIndex);

  const stamps = new Map<bigint, number>();
  const events: StoredEvent[] = [];
  for (const log of logs) {
    const event = toMirrorEvent(log.name, log.args, log.blockNumber, log.logIndex);
    if (!event) continue;
    if (!stamps.has(log.blockNumber))
      stamps.set(log.blockNumber, await source.timestampAt(log.blockNumber));
    events.push({ ...event, ts: stamps.get(log.blockNumber) ?? 0 });
  }

  if (events.length === 0) {
    const gap = target - (checkpoint?.block ?? deployBlock - 1n);
    if (gap >= IDLE_CHECKPOINT_GAP)
      await store.setCheckpoint({
        block: target,
        hash: (await source.hashAt(target)) ?? ZERO_HASH,
      });
    return { from, to: target, written: 0, reorged };
  }

  const batches = inBatches(events);
  for (const [index, batch] of batches.entries()) {
    const isLast = index === batches.length - 1;
    const block = isLast ? target : (batch.at(-1)?.block ?? target);
    await store.write({
      events: batch,
      checkpoint: { block, hash: (await source.hashAt(block)) ?? ZERO_HASH },
    });
  }
  return { from, to: target, written: events.length, reorged };
}

/** Groups events into writes of at most BATCH_EVENTS, never splitting one block's events across two. */
function inBatches(events: StoredEvent[]): StoredEvent[][] {
  const batches: StoredEvent[][] = [];
  let current: StoredEvent[] = [];
  let i = 0;
  while (i < events.length) {
    const block = events[i]?.block;
    const group: StoredEvent[] = [];
    while (i < events.length && events[i]?.block === block) group.push(events[i++] as StoredEvent);
    if (current.length > 0 && current.length + group.length > BATCH_EVENTS) {
      batches.push(current);
      current = [];
    }
    current.push(...group);
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

const maxBigInt = (a: bigint, b: bigint) => (a > b ? a : b);
