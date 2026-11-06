import type { Clock, IdGenerator, StorageAdapter } from '@/platform/ports';
import { logger } from '@/utils/logger';
import { formatBacklog } from '@/utils/outboxBacklog';
import { MAX_AUTO_ATTEMPTS, nextAttemptAt } from '@/utils/syncSchedule';

export const OUTBOX_KEY = '@stryde/outbox';

export interface OutboxEntry {
  id: string;
  /** Which handler delivers it, e.g. `setKudos`. */
  kind: string;
  payload: unknown;
  /** Names what the intent is about (`kudos:<activity>`): a newer intent for the same key replaces a waiting one. */
  key?: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  /** `failed` has used up its automatic tries and waits for a manual `retry`. */
  status: 'pending' | 'failed';
  lastError?: string;
  /** When it first failed to send; kept through retries so slowness is measured from there. Absent on older saved entries. */
  firstFailedAt?: number;
}

/** Delivers one intent. Throw `RejectedError` for a definite no; any other throw means "try again later". */
export type Handler = (payload: unknown) => Promise<void>;
export type Handlers = Record<string, Handler>;

/** The other side said no for good (not a network blip): the optimistic change must be undone. */
export class RejectedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'RejectedError';
  }
}

export interface OutboxDeps {
  storage: StorageAdapter;
  clock: Clock;
  ids: IdGenerator;
  handlers: Handlers;
  isOnline(): boolean;
  /** Called when an intent was definitively rejected, after it was removed. */
  onRejected(entry: OutboxEntry, reason: string): void;
}

export interface Outbox {
  /** Brings back what was waiting before a restart. Runs once; every other call waits for it. */
  hydrate(): Promise<void>;
  enqueue(input: { kind: string; payload: unknown; key?: string }): Promise<OutboxEntry>;
  /** Delivers what is due. Safe to call at any time; only one runs at once. */
  drain(): Promise<void>;
  /** Gives a failed intent a fresh set of automatic tries. */
  retry(id: string): Promise<void>;
  /** Oldest first. The same array until something changes, so it works as a store snapshot. */
  entries(): readonly OutboxEntry[];
  subscribe(listener: () => void): () => void;
  statusOf(key: string): OutboxEntry['status'] | undefined;
  /**
   * True once, if the change filed under `key` was definitively refused. It is noted before the entry
   * leaves the queue, so a listener that sees the entry go can already ask why.
   */
  consumeRejection(key: string): boolean;
  pendingCount(): number;
  /** Goes up each time `clear` runs, so a listener can tell "discarded" from "delivered". */
  clearCount(): number;
  /** Forgets everything queued, saved copy included (signing out or deleting this device's data). */
  clear(): Promise<void>;
}

function isEntry(value: unknown): value is OutboxEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.kind === 'string' &&
    typeof v.createdAt === 'number' &&
    typeof v.attempts === 'number' &&
    typeof v.nextAttemptAt === 'number' &&
    (v.status === 'pending' || v.status === 'failed')
  );
}

/**
 * A durable list of things the app has done locally and still has to tell the outside world.
 * Screens apply a change to their own state at once and enqueue the intent; the outbox delivers it
 * in the background with backoff. Nothing in the UI waits for it.
 */
export function createOutbox(deps: OutboxDeps): Outbox {
  const { storage, clock, ids, handlers } = deps;
  let items: OutboxEntry[] = [];
  const rejectedKeys = new Set<string>();
  let clears = 0;
  let inFlightId: string | null = null;
  let running: Promise<void> | null = null;
  /** After a transient failure the whole queue waits, since one failure usually means the path is down. */
  let pausedUntil = 0;
  let hydration: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  function commit(next: OutboxEntry[]): void {
    items = next;
    for (const listener of [...listeners]) listener();
  }

  async function persist(): Promise<void> {
    try {
      await storage.setItem(OUTBOX_KEY, JSON.stringify(items));
    } catch (error) {
      logger.warn('[Outbox] Could not save the queue', error);
    }
  }

  const replace = (entry: OutboxEntry) =>
    commit(items.map((item) => (item.id === entry.id ? entry : item)));
  const remove = (id: string) => commit(items.filter((item) => item.id !== id));

  function nextDue(): OutboxEntry | undefined {
    const now = clock.now();
    return items.find(
      (item) => item.status === 'pending' && item.nextAttemptAt <= now && item.kind in handlers
    );
  }

  async function deliver(entry: OutboxEntry): Promise<'continue' | 'stop'> {
    const handler = handlers[entry.kind];
    if (!handler) return 'stop';
    inFlightId = entry.id;
    try {
      await handler(entry.payload);
    } catch (error) {
      inFlightId = null;
      if (error instanceof RejectedError) {
        logger.warn(`[Outbox] ${entry.kind} rejected: ${error.message}`);
        if (entry.key) rejectedKeys.add(entry.key);
        remove(entry.id);
        await persist();
        deps.onRejected(entry, error.message);
        return 'continue';
      }
      const attempts = entry.attempts + 1;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[Outbox] ${entry.kind} failed (attempt ${attempts})`, message);
      const gaveUp = attempts >= MAX_AUTO_ATTEMPTS;
      const retryAt = nextAttemptAt(clock.now(), attempts);
      replace({
        ...entry,
        attempts,
        lastError: message,
        firstFailedAt: entry.firstFailedAt ?? clock.now(),
        status: gaveUp ? 'failed' : 'pending',
        nextAttemptAt: retryAt,
      });
      if (!gaveUp) pausedUntil = retryAt;
      await persist();
      return 'stop';
    }
    inFlightId = null;
    pausedUntil = 0;
    logger.debug(`[Outbox] ${entry.kind} delivered`);
    remove(entry.id);
    await persist();
    return 'continue';
  }

  async function load(): Promise<void> {
    try {
      const raw = await storage.getItem(OUTBOX_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      commit(Array.isArray(parsed) ? parsed.filter(isEntry) : []);
      const backlog = formatBacklog(items, clock.now());
      if (backlog) logger.info(backlog);
    } catch (error) {
      // Unreadable or corrupt storage starts the queue empty; say so, since queued deliveries are lost with it.
      logger.warn('[Outbox] Could not read the saved queue, starting empty', error);
      commit([]);
    }
  }

  function hydrate(): Promise<void> {
    hydration ??= load();
    return hydration;
  }

  async function run(): Promise<void> {
    await hydrate();
    if (!deps.isOnline() || clock.now() < pausedUntil) return;
    for (let entry = nextDue(); entry; entry = nextDue()) {
      if ((await deliver(entry)) === 'stop') return;
    }
  }

  return {
    hydrate,

    async enqueue({ kind, payload, key }) {
      await hydrate();
      // A fresh intent starts clean: an old refusal must not colour this one's outcome.
      if (key) rejectedKeys.delete(key);
      const waiting = key
        ? items.find((item) => item.key === key && item.id !== inFlightId)
        : undefined;
      const entry: OutboxEntry = waiting
        ? {
            ...waiting,
            payload,
            attempts: 0,
            nextAttemptAt: clock.now(),
            status: 'pending',
            lastError: undefined,
            firstFailedAt: undefined,
          }
        : {
            id: ids.next(),
            kind,
            payload,
            key,
            createdAt: clock.now(),
            attempts: 0,
            nextAttemptAt: clock.now(),
            status: 'pending',
          };
      if (waiting) replace(entry);
      else commit([...items, entry]);
      await persist();
      return entry;
    },

    drain() {
      running ??= run().finally(() => {
        running = null;
      });
      return running;
    },

    async clear() {
      await hydrate();
      rejectedKeys.clear();
      clears += 1;
      commit([]);
      await persist();
    },

    async retry(id) {
      await hydrate();
      const entry = items.find((item) => item.id === id);
      if (!entry) return;
      pausedUntil = 0;
      replace({
        ...entry,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: clock.now(),
        lastError: undefined,
        firstFailedAt: undefined,
      });
      await persist();
    },

    entries: () => items,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    statusOf: (key) => items.find((item) => item.key === key)?.status,
    consumeRejection: (key) => rejectedKeys.delete(key),
    clearCount: () => clears,
    pendingCount: () => items.filter((item) => item.status === 'pending').length,
  };
}
