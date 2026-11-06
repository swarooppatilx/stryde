import { eq, gte } from '@arkiv-network/sdk/query';
import { addr, bytes, defineSchema, key, str, u64 } from '@arkiv-network/sdk/schema';
import { toAddress } from './address.js';
import {
  type ArkivPublicClient,
  type ArkivWalletClient,
  createEntityStore,
  type JsonEntityLike,
  readJson,
  secondsAttribute,
  textAttribute,
  walletAttribute,
} from './arkivEntityStore.js';
import type { ClubRecord, ClubStore, RecordKind } from './clubs.js';

export const ClubRecordSchema = defineSchema('club_record', {
  club_id: str().indexed(),
  kind: str().indexed(),
  subject: str().indexed(),
  author: addr().indexed(),
  created_at: u64().indexed(),
  client_id: str().indexed(),
  data: bytes(),
});

const KINDS: readonly RecordKind[] = [
  'post',
  'comment',
  'settings',
  'role',
  'request',
  'removed',
  'event',
  'notify',
];

export function clubRecordFromEntity(entity: JsonEntityLike): ClubRecord | null {
  const author = walletAttribute(entity, 'author');
  const clubId = textAttribute(entity, 'club_id');
  const kind = textAttribute(entity, 'kind') as RecordKind | null;
  if (!author || !clubId || !kind || !KINDS.includes(kind)) return null;
  const body = readJson(entity) as { data?: unknown } | null;
  const data =
    body && typeof body.data === 'object' && body.data !== null
      ? (body.data as Record<string, unknown>)
      : null;
  if (!data) return null;
  const subject = textAttribute(entity, 'subject') ?? '';
  return {
    id: entity.key,
    clubId,
    kind,
    // Addresses come back as stored; keep the lowercase form the service compares with.
    subject: toAddress(subject) ?? subject,
    author,
    data,
    createdAt: secondsAttribute(entity, 'created_at'),
    clientId: textAttribute(entity, 'client_id') ?? '',
  };
}

/** Club records as Arkiv entities written by this server's signer. */
export function createArkivClubStore(
  publicClient: ArkivPublicClient,
  walletClient: ArkivWalletClient
): ClubStore {
  const entities = createEntityStore(publicClient, walletClient, ClubRecordSchema);
  const parse = (found: { entities: JsonEntityLike[] }) =>
    found.entities.map(clubRecordFromEntity).filter((r): r is ClubRecord => r !== null);

  return {
    async add({ signature, deadline, ...record }) {
      const entityKey = await entities.create(
        { data: record.data, signature, deadline },
        {
          club_id: str(record.clubId),
          kind: str(record.kind),
          subject: str(record.subject),
          author: addr(record.author),
          created_at: u64(record.createdAt),
          client_id: str(record.clientId),
        }
      );
      return { ...record, id: entityKey };
    },

    async find(id) {
      const found = await entities.queryWithPayload([eq('$key', key(id as `0x${string}`))], 1);
      return parse(found)[0] ?? null;
    },

    remove: (id) => entities.remove(id),

    async list(clubId, kinds) {
      const all: ClubRecord[] = [];
      for (const kind of kinds) {
        all.push(
          ...parse(
            await entities.queryWithPayload([eq('club_id', str(clubId)), eq('kind', str(kind))])
          )
        );
      }
      return all.sort((a, b) => a.createdAt - b.createdAt);
    },

    async findByClientId(clubId, author, clientId) {
      const found = await entities.queryWithPayload(
        [eq('club_id', str(clubId)), eq('author', addr(author)), eq('client_id', str(clientId))],
        1
      );
      return parse(found)[0] ?? null;
    },

    async countWritesSince(author, since) {
      const filters = (kind: string) => [
        eq('author', addr(author)),
        eq('kind', str(kind)),
        gte('created_at', u64(since)),
      ];
      return (await entities.count(filters('post'))) + (await entities.count(filters('comment')));
    },
  };
}
