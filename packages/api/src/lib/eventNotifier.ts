import type { Address } from './address.js';
import { toAddress } from './address.js';
import { logError } from './logError.js';
import type { PushMessage } from './pushSender.js';

/** Public RPCs reject eth_getLogs spans over 50,000 blocks; stay well under. */
export const NOTIFY_WINDOW_BLOCKS = 40_000n;
/** With no checkpoint yet, start this far behind head so history is never replayed as news. */
export const FIRST_RUN_LOOKBACK_BLOCKS = 200n;
/** Attempts per event (notify or recipient lookup) before it is logged and given up on. */
export const MAX_ATTEMPTS = 3;
/** A quiet stretch this long is still worth recording, so the next scan stays short. */
export const IDLE_PERSIST_BLOCKS = 1_000n;

/** A log as viem returns it for the watched events (`strict: true`, decoded). */
export type WatchedLog = {
  transactionHash: `0x${string}`;
  logIndex: number;
  blockNumber: bigint;
} & (
  | { eventName: 'KudosGiven'; args: { activityId: bigint; giver: Address } }
  | { eventName: 'CommentAdded'; args: { activityId: bigint; author: Address } }
  | {
      eventName: 'ChallengeCreated';
      args: { challengeId: bigint; challenger: Address; opponent: Address };
    }
);

export type NotifyKind = 'kudos' | 'comments' | 'challenges';

export interface DecodedEvent {
  key: string;
  kind: NotifyKind;
  actor: Address;
  /** Set when the event names the recipient itself (a challenge's opponent). */
  recipient?: Address;
  /** The activity the event is about, whose owner is the recipient, when `recipient` is unset. */
  activityId?: bigint;
  /** What the app opens on tap. */
  id: string;
}

export function decodeLog(log: WatchedLog): DecodedEvent | null {
  const key = `${log.transactionHash.toLowerCase()}:${log.logIndex}`;
  const actor = (value: unknown) => toAddress(value);
  switch (log.eventName) {
    case 'KudosGiven': {
      const giver = actor(log.args.giver);
      return giver
        ? {
            key,
            kind: 'kudos',
            actor: giver,
            activityId: log.args.activityId,
            id: String(log.args.activityId),
          }
        : null;
    }
    case 'CommentAdded': {
      const author = actor(log.args.author);
      return author
        ? {
            key,
            kind: 'comments',
            actor: author,
            activityId: log.args.activityId,
            id: String(log.args.activityId),
          }
        : null;
    }
    case 'ChallengeCreated': {
      const challenger = actor(log.args.challenger);
      const opponent = actor(log.args.opponent);
      return challenger && opponent
        ? {
            key,
            kind: 'challenges',
            actor: challenger,
            recipient: opponent,
            id: String(log.args.challengeId),
          }
        : null;
    }
    default:
      return null;
  }
}

const COPY: Record<NotifyKind, { title: string; body: string }> = {
  kudos: { title: 'New kudos', body: 'Someone gave your activity kudos' },
  comments: { title: 'New comment', body: 'Someone commented on your activity' },
  challenges: { title: 'New challenge', body: 'Someone challenged you' },
};

export function eventMessage(event: Pick<DecodedEvent, 'kind' | 'id'>): PushMessage {
  return { ...COPY[event.kind], data: { kind: event.kind, id: event.id } };
}

export interface Checkpoint {
  /** The last block fully handled, or null before the first run. */
  get(): Promise<bigint | null>;
  set(block: bigint): Promise<void>;
}

export interface NotifyDeps {
  head(): Promise<bigint>;
  getLogs(range: { fromBlock: bigint; toBlock: bigint }): Promise<WatchedLog[]>;
  /** The owner of an activity; null when unknown. */
  resolveRecipient(activityId: bigint): Promise<Address | null>;
  notify(recipient: Address, message: PushMessage): Promise<void>;
  checkpoint: Checkpoint;
}

export interface NotifyReport {
  from: string;
  to: string;
  windows: number;
  events: number;
  sent: number;
  skipped: number;
  failed: number;
  /** True when a log read failed and the run stopped early; the checkpoint stays put. */
  incomplete: boolean;
}

async function attempt<T>(label: string, run: () => Promise<T>): Promise<T | undefined> {
  for (let tries = 1; tries <= MAX_ATTEMPTS; tries++) {
    try {
      return await run();
    } catch (error) {
      if (tries === MAX_ATTEMPTS) logError(`[eventNotifier] ${label} failed`, error);
    }
  }
  return undefined;
}

interface RunState {
  report: NotifyReport;
  seen: Set<string>;
  owners: Map<bigint, Address | null>;
}

async function recipientOf(deps: NotifyDeps, event: DecodedEvent, state: RunState) {
  if (event.recipient) return event.recipient;
  const activityId = event.activityId;
  if (activityId === undefined) return null;
  if (!state.owners.has(activityId)) {
    const owner = await attempt('Resolving an activity owner', () =>
      deps.resolveRecipient(activityId)
    );
    if (owner !== undefined) state.owners.set(activityId, owner);
  }
  return state.owners.get(activityId) ?? null;
}

/** Handles one new event; returns false for a log that is not ours or was already seen. */
async function handleLog(deps: NotifyDeps, log: WatchedLog, state: RunState): Promise<boolean> {
  const event = decodeLog(log);
  if (!event || state.seen.has(event.key)) return false;
  state.seen.add(event.key);
  state.report.events += 1;

  const recipient = await recipientOf(deps, event, state);
  if (!recipient || recipient === event.actor) {
    state.report.skipped += 1;
    return true;
  }
  const done = await attempt('Sending a push', async () => {
    await deps.notify(recipient, eventMessage(event));
    return true;
  });
  if (done) state.report.sent += 1;
  else state.report.failed += 1;
  return true;
}

function byPosition(a: WatchedLog, b: WatchedLog): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  return a.logIndex - b.logIndex;
}

function firstBlock(head: bigint, stored: bigint | null): bigint {
  if (stored !== null) return stored + 1n;
  return head > FIRST_RUN_LOOKBACK_BLOCKS ? head - FIRST_RUN_LOOKBACK_BLOCKS : 0n;
}

/**
 * Scans from the checkpoint to head and pushes one message per new kudos, comment or challenge invite.
 * Never throws: a failing send is retried a few times, logged and passed over so one bad event cannot
 * hold the checkpoint back forever.
 */
export async function notifyNewEvents(deps: NotifyDeps): Promise<NotifyReport> {
  const head = await deps.head();
  const stored = await deps.checkpoint.get();
  const start = firstBlock(head, stored);
  const state: RunState = {
    report: {
      from: start.toString(),
      to: head.toString(),
      windows: 0,
      events: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      incomplete: false,
    },
    seen: new Set(),
    owners: new Map(),
  };
  let persisted = stored;

  for (let from = start; from <= head; from += NOTIFY_WINDOW_BLOCKS) {
    const to = from + NOTIFY_WINDOW_BLOCKS - 1n < head ? from + NOTIFY_WINDOW_BLOCKS - 1n : head;
    let logs: WatchedLog[];
    try {
      logs = await deps.getLogs({ fromBlock: from, toBlock: to });
    } catch (error) {
      logError('[eventNotifier] Reading logs failed', error);
      state.report.incomplete = true;
      break;
    }
    state.report.windows += 1;

    let handled = 0;
    for (const log of [...logs].sort(byPosition)) {
      if (await handleLog(deps, log, state)) handled += 1;
    }

    if (handled > 0 || persisted === null || to - persisted >= IDLE_PERSIST_BLOCKS) {
      try {
        await deps.checkpoint.set(to);
        persisted = to;
      } catch (error) {
        logError('[eventNotifier] Saving the checkpoint failed', error);
        state.report.incomplete = true;
        break;
      }
    }
  }
  return state.report;
}
