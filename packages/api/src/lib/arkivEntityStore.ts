import { ExpirationTime } from '@arkiv-network/sdk';
import { asc, type Expression } from '@arkiv-network/sdk/query';
import type { Schema } from '@arkiv-network/sdk/schema';
import { hexToString, isHex, stringToBytes } from 'viem';
import { type Address, toAddress } from './address.js';
import type { createArkivPublicClient, createArkivWalletClient } from './arkiv.js';

export type ArkivPublicClient = ReturnType<typeof createArkivPublicClient>;
export type ArkivWalletClient = ReturnType<typeof createArkivWalletClient>;

/** Most entities one read returns; larger sets come back truncated, as before the move to Rabdi. */
export const PAGE_LIMIT = 200;
/** The most rows the node returns in one request. */
const NODE_PAGE_LIMIT = 100;
/**
 * Social records live this long; renewal is handled elsewhere. Rabdi refuses lifetimes beyond about
 * 182.5 days (7,884,000 blocks), so this is the longest round number under it.
 */
export const SOCIAL_LIFETIME_DAYS = 180;
/** The column that holds an entity's JSON body. Stored, never indexed. */
export const DATA_COLUMN = 'data';

/** The part of an Arkiv entity the stores read: its key and typed columns by name. */
export interface EntityLike {
  key: string;
  attributes: Record<string, { type: string; value: unknown } | undefined>;
}

/** An entity that also carries a JSON payload (read with `payload: true`). */
export interface JsonEntityLike extends EntityLike {
  toJson(): unknown;
}

/** A wallet stored as an `addr` attribute, lowercased; null when absent or malformed. */
export function walletAttribute(entity: EntityLike, name: string): Address | null {
  const attribute = entity.attributes[name];
  return attribute?.type === 'addr' ? toAddress(attribute.value) : null;
}

/** A `u64` attribute as a number (unix seconds); 0 when absent, for records written before it existed. */
export function secondsAttribute(entity: EntityLike, name: string): number {
  const attribute = entity.attributes[name];
  return attribute?.type === 'u64' ? Number(attribute.value) : 0;
}

/** A `str` attribute; null when absent or not text. */
export function textAttribute(entity: EntityLike, name: string): string | null {
  const attribute = entity.attributes[name];
  return attribute?.type === 'str' && typeof attribute.value === 'string' ? attribute.value : null;
}

/** The entity's JSON payload, or null when it cannot be decoded. */
export function readJson(entity: JsonEntityLike): unknown {
  try {
    return entity.toJson();
  } catch {
    return null;
  }
}

type Filter = Expression;
type Row = Record<string, unknown> & { $key: string };

/** A row from the SDK as the stores read it: key, typed columns, and the decoded JSON body if one was fetched. */
function toEntity(row: Row): JsonEntityLike {
  const attributes: EntityLike['attributes'] = {};
  for (const [name, value] of Object.entries(row)) {
    if (name.startsWith('$') || name === DATA_COLUMN) continue;
    attributes[name] = value as { type: string; value: unknown };
  }
  const data = row[DATA_COLUMN] as { value?: unknown } | undefined;
  return {
    key: row.$key,
    attributes,
    toJson() {
      if (!data || !isHex(data.value)) throw new Error('This entity was read without its body');
      return JSON.parse(hexToString(data.value));
    },
  };
}

/** The columns to fetch: everything the schema declares, minus the (large) body unless asked for. */
function selectionFor(schema: Schema, withPayload: boolean): Record<string, true> {
  const selection: Record<string, true> = { $key: true };
  for (const name of Object.keys(schema.columns)) {
    if (name === DATA_COLUMN && !withPayload) continue;
    selection[name] = true;
  }
  return selection;
}

/** Reads and writes one kind of entity, all scoped to the entities this server's signer created. */
export function createEntityStore(
  publicClient: ArkivPublicClient,
  walletClient: ArkivWalletClient,
  schema: Schema,
  lifetimeDays = SOCIAL_LIFETIME_DAYS
) {
  const creator = walletClient.account.address;

  // The schema's types are checked where each store builds its filters; this core handles any schema, so its builder calls are loosely typed.
  const builder = (selection: Record<string, true>, filters: Filter[]) => {
    let query = (publicClient as never as { select(s: unknown): { from(s: unknown): never } })
      .select(selection)
      .from(schema) as unknown as {
      createdBy(a: string): typeof query;
      where(...e: Filter[]): typeof query;
      orderBy(t: unknown): typeof query;
      limit(n: number): typeof query;
      offset(n: number): typeof query;
      fetch(): Promise<{ entities: Row[]; skipped: number }>;
    };
    query = query.createdBy(creator);
    if (filters.length > 0) query = query.where(...filters);
    return query;
  };

  /** Pages through the matches (sorted by key so offsets line up) until `limit` are read, plus one to tell if more remain. */
  async function read(filters: Filter[], limit: number, withPayload: boolean) {
    const selection = selectionFor(schema, withPayload);
    const found: Row[] = [];
    let offset = 0;
    // Once a page has skipped rows, the rows still needed are no guide to the page size: shrinking it would only add requests.
    let sawSkips = false;
    while (found.length < limit + 1) {
      const want = sawSkips ? NODE_PAGE_LIMIT : Math.min(NODE_PAGE_LIMIT, limit + 1 - found.length);
      const page = await builder(selection, filters)
        .orderBy(asc('$key'))
        .limit(want)
        .offset(offset)
        .fetch();
      found.push(...page.entities);
      // `skipped` rows matched but did not fit the schema; they still used up positions.
      const consumed = page.entities.length + page.skipped;
      if (page.skipped > 0) sawSkips = true;
      offset += consumed;
      if (consumed < want) break;
    }
    return {
      entities: found.slice(0, limit).map(toEntity),
      truncated: found.length > limit,
    };
  }

  return {
    creator,

    /** Entities matching `filters`: key and columns only. */
    query: (filters: Filter[], limit = PAGE_LIMIT) => read(filters, limit, false),

    /** Like `query`, with each entity's body so `toJson()` works. */
    queryWithPayload: (filters: Filter[], limit = PAGE_LIMIT) => read(filters, limit, true),

    /** How many entities match, up to `limit`. */
    async count(filters: Filter[], limit = PAGE_LIMIT) {
      let query = (publicClient as never as { count(): { from(s: unknown): never } })
        .count()
        .from(schema) as unknown as {
        createdBy(a: string): typeof query;
        where(...e: Filter[]): typeof query;
        fetch(): Promise<bigint>;
      };
      query = query.createdBy(creator);
      if (filters.length > 0) query = query.where(...filters);
      return Math.min(Number(await query.fetch()), limit);
    },

    /** Writes a JSON entity that nobody, the signer included, can edit; it can only be deleted. */
    async create(body: Record<string, unknown>, values: Record<string, unknown>) {
      const { entityKey } = await (
        walletClient as never as {
          createEntity(s: unknown, v: unknown, o: unknown): Promise<{ entityKey: string }>;
        }
      ).createEntity(
        schema,
        { ...values, [DATA_COLUMN]: stringToBytes(JSON.stringify({ v: 1, ...body })) },
        {
          expiration: ExpirationTime.fromDays(lifetimeDays),
          flags: { readonly: true, permissionlessExtension: false },
        }
      );
      return entityKey;
    },

    async remove(entityKey: string) {
      await walletClient.deleteEntity({ entityKey: entityKey as Address });
    },
  };
}
