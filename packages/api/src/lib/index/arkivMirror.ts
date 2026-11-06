import { ExpirationTime } from '@arkiv-network/sdk';
import { type Expression, eq, gt } from '@arkiv-network/sdk/query';
import { addr, bytes, defineSchema, str, u64 } from '@arkiv-network/sdk/schema';
import type { Hex } from 'viem';
import { stringToBytes } from 'viem';
import {
  type ArkivPublicClient,
  type ArkivWalletClient,
  createEntityStore,
  type EntityLike,
  readJson,
  SOCIAL_LIFETIME_DAYS,
  textAttribute,
  walletAttribute,
} from '../arkivEntityStore.js';
import type { Checkpoint, MirrorStore, StoredEvent } from './mirror.js';
import { compare } from './order.js';
import type { Address } from './types.js';

/**
 * One entity per chain event. Only indexed columns can be filtered, so the four reads depend on are
 * indexed: what happened (`kind`), when (`block`, `evt`), to whom (`who`) and about what (`ref`).
 * `data` holds every decoded argument as JSON.
 */
export const EventSchema = defineSchema('idx_event', {
  kind: str().indexed(),
  evt: str().indexed(),
  block: u64().indexed(),
  ts: u64().indexed(),
  who: addr().indexed(),
  ref: str().indexed(),
  data: bytes(),
});

/** Where the mirror is up to; replaced, never edited, in the same transaction as the events it covers. */
export const CheckpointSchema = defineSchema('idx_checkpoint', {
  stream: str().indexed(),
  block: u64(),
  hash: str(),
});

const STREAM = 'main';
/** Deletions in one Arkiv transaction; a rewind of many events is split into this many at a time. */
const DELETES_PER_BATCH = 50;
/** Most events one read returns; the leaderboard-sized sets the mirror serves fit well inside. */
export const READ_LIMIT = 5_000;
const EVENT_LIFETIME = ExpirationTime.fromDays(SOCIAL_LIFETIME_DAYS);
const FLAGS = { readonly: true, permissionlessExtension: false } as const;

export interface EventQuery {
  kind: string;
  who?: Address;
  ref?: string;
  limit?: number;
}

export interface ArkivMirror extends MirrorStore {
  /** Events of one kind in chain order, optionally for one wallet and/or one reference. */
  events(query: EventQuery): Promise<StoredEvent[]>;
}

const number = (entity: EntityLike, name: string): bigint => {
  const attribute = entity.attributes[name];
  return attribute?.type === 'u64' ? BigInt(attribute.value as bigint | number | string) : 0n;
};

/** The mirror kept as Arkiv entities written by this server's signer; only that signer's entities count. */
export function createArkivMirrorStore(
  publicClient: ArkivPublicClient,
  walletClient: ArkivWalletClient
): ArkivMirror {
  const events = createEntityStore(publicClient, walletClient, EventSchema);
  const checkpoints = createEntityStore(publicClient, walletClient, CheckpointSchema);
  const batch = (
    walletClient as never as {
      executeBatch(b: unknown): Promise<unknown>;
    }
  ).executeBatch.bind(walletClient);

  const eventCreate = (event: StoredEvent) => ({
    schema: EventSchema,
    values: {
      kind: str(event.kind),
      evt: str(event.evt),
      block: u64(event.block),
      ts: u64(event.ts),
      who: addr(event.who),
      ref: str(event.ref),
      data: stringToBytes(JSON.stringify({ v: 1, ...event.data })),
    },
    expiration: EVENT_LIFETIME,
    flags: FLAGS,
  });

  const checkpointCreate = (checkpoint: Checkpoint) => ({
    schema: CheckpointSchema,
    values: { stream: str(STREAM), block: u64(checkpoint.block), hash: str(checkpoint.hash) },
    expiration: EVENT_LIFETIME,
    flags: FLAGS,
  });

  async function savedCheckpoints() {
    const found = await checkpoints.query([eq('stream', STREAM)]);
    return found.entities
      .map((entity) => ({
        key: entity.key,
        block: number(entity, 'block'),
        hash: (textAttribute(entity, 'hash') ?? '') as Hex,
      }))
      .sort((a, b) => compare(b.block, a.block));
  }

  return {
    async checkpoint() {
      const [newest] = await savedCheckpoints();
      return newest ? { block: newest.block, hash: newest.hash } : null;
    },

    async write({ events: toWrite, checkpoint }) {
      const old = await savedCheckpoints();
      await batch({
        creates: [...toWrite.map(eventCreate), checkpointCreate(checkpoint)],
        deletes: old.map((entry) => ({ entityKey: entry.key })),
      });
    },

    async setCheckpoint(checkpoint) {
      const old = await savedCheckpoints();
      await batch({
        creates: [checkpointCreate(checkpoint)],
        deletes: old.map((entry) => ({ entityKey: entry.key })),
      });
    },

    async rewindTo(block) {
      let deleted = 0;
      for (;;) {
        const tail = await events.query([gt('block', u64(block))], DELETES_PER_BATCH);
        if (tail.entities.length === 0) return deleted;
        await batch({ deletes: tail.entities.map((entity) => ({ entityKey: entity.key })) });
        deleted += tail.entities.length;
      }
    },

    async events({ kind, who, ref, limit = READ_LIMIT }) {
      const filters: Expression[] = [eq('kind', kind)];
      if (who) filters.push(eq('who', addr(who)));
      if (ref !== undefined) filters.push(eq('ref', ref));
      const found = await events.queryWithPayload(filters, limit, 'evt');
      const stored: StoredEvent[] = [];
      for (const entity of found.entities) {
        const body = readJson(entity);
        const { v: _version, ...data } = (body ?? {}) as Record<string, string>;
        stored.push({
          kind: textAttribute(entity, 'kind') ?? kind,
          evt: textAttribute(entity, 'evt') ?? '',
          block: number(entity, 'block'),
          ts: Number(number(entity, 'ts')),
          who: (walletAttribute(entity, 'who') ?? who ?? '0x') as Address,
          ref: textAttribute(entity, 'ref') ?? '',
          data,
        });
      }
      return stored;
    },
  };
}
