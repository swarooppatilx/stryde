import type { Address } from './address.js';
import { IntentError } from './intentError.js';
import { createSerialQueue } from './serialQueue.js';
import { createIntentGuards, unixNow } from './signedIntent.js';
import { MULTI_LINE_CONTROL_CHARACTERS, ONE_LINE_CONTROL_CHARACTERS } from './textRules.js';

/**
 * Everything about a club that the GroupRegistry contract does not hold: its feed, its look and
 * settings, who helps run it, who asked to join, who was removed, its events and each member's
 * notification choice. Membership and the treasury stay on chain; this service reads the chain to
 * know who owns the club and who belongs to it.
 */

export type ClubErrorCode =
  | 'invalid'
  | 'expired'
  | 'bad_signature'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited';

export class ClubError extends IntentError<ClubErrorCode> {
  constructor(code: ClubErrorCode, message: string) {
    super(code, message);
    this.name = 'ClubError';
  }
}

const guard = createIntentGuards((code, message) => new ClubError(code, message));

export const CLUB_ACTIONS = [
  'post',
  'delete-post',
  'comment',
  'delete-comment',
  'settings',
  'set-role',
  'request',
  'cancel-request',
  'decide',
  'remove-member',
  'link-event',
  'unlink-event',
  'notify',
] as const;
export type ClubAction = (typeof CLUB_ACTIONS)[number];

export interface ClubIntent {
  actor: Address;
  /** The on-chain group id, in decimal. */
  clubId: string;
  action: ClubAction;
  /** What the action is about: a post or comment id, a member's address, an event id; empty when none. */
  target: string;
  /** The action's fields as JSON text, signed exactly as sent. */
  data: string;
  /** Kept across retries of a new post or comment so it is stored once. Empty otherwise. */
  clientId: string;
  deadline: number;
}

export type RecordKind =
  | 'post'
  | 'comment'
  | 'settings'
  | 'role'
  | 'request'
  | 'removed'
  | 'event'
  | 'notify';

export interface ClubRecord {
  id: string;
  clubId: string;
  kind: RecordKind;
  /** A post's id for a comment, a member's address for a role/request/removal/notify, an event id. */
  subject: string;
  author: Address;
  data: Record<string, unknown>;
  createdAt: number;
  clientId: string;
}

export interface ClubStore {
  add(
    record: Omit<ClubRecord, 'id'> & { signature: string; deadline: number }
  ): Promise<ClubRecord>;
  find(id: string): Promise<ClubRecord | null>;
  remove(id: string): Promise<void>;
  /** Every record of these kinds for a club, oldest first. */
  list(clubId: string, kinds: readonly RecordKind[]): Promise<ClubRecord[]>;
  findByClientId(clubId: string, author: Address, clientId: string): Promise<ClubRecord | null>;
  /** How many posts and comments this author wrote since `since`, across clubs. */
  countWritesSince(author: Address, since: number): Promise<number>;
}

/** The club as the chain knows it. */
export interface ClubChain {
  owner(clubId: string): Promise<Address | null>;
  isMember(clubId: string, member: Address): Promise<boolean>;
}

export interface ClubSettings {
  name: string;
  location: string;
  description: string;
  /** IPFS content ids; empty when not set. */
  photo: string;
  cover: string;
  /** New members need an admin's approval. */
  inviteOnly: boolean;
  /** Only admins may post. */
  adminsOnlyPost: boolean;
  showLeaderboard: boolean;
}

export const DEFAULT_SETTINGS: ClubSettings = {
  name: '',
  location: '',
  description: '',
  photo: '',
  cover: '',
  inviteOnly: false,
  adminsOnlyPost: false,
  showLeaderboard: true,
};

export type NotifyLevel = 'all' | 'announcements' | 'off';
export type RequestStatus = 'pending' | 'approved' | 'declined';

export const MAX_CLUB_POST_LENGTH = 1000;
export const MAX_CLUB_COMMENT_LENGTH = 500;
export const MAX_CLUB_PHOTOS = 4;
/** Posts and comments are writes the server pays for. */
export const MAX_CLUB_WRITES_PER_DAY = 60;
const MAX_FEED = 50;
const MAX_COMMENTS_PER_POST = 50;
const DAY_SECONDS = 24 * 60 * 60;
const CID_PATTERN = /^[A-Za-z0-9]{40,120}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const CLUB_ID_PATTERN = /^[0-9]{1,30}$/;

function parseData(raw: string): Record<string, unknown> {
  if (raw === '') return {};
  try {
    const value = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // Falls through to the refusal.
  }
  throw new ClubError('invalid', 'data must be a JSON object');
}

function parseIntent(raw: unknown): ClubIntent {
  const input = guard.record(raw);
  if (!CLUB_ACTIONS.includes(input.action as ClubAction)) {
    throw new ClubError('invalid', 'unknown club action');
  }
  const clubId = guard.string(input.clubId, 'clubId');
  if (!CLUB_ID_PATTERN.test(clubId)) throw new ClubError('invalid', 'clubId must be a number');
  const data = guard.string(input.data, 'data');
  if (data.length > 6000) throw new ClubError('invalid', 'data is too long');
  return {
    actor: guard.address(input.actor, 'actor'),
    clubId,
    action: input.action as ClubAction,
    target: guard.string(input.target, 'target'),
    data,
    clientId: guard.string(input.clientId, 'clientId'),
    deadline: guard.deadline(input.deadline),
  };
}

const bool = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') throw new ClubError('invalid', `${field} must be true or false`);
  return value;
};

const cidOrEmpty = (value: unknown, field: string): string => {
  const text = guard.string(value ?? '', field);
  if (text && !CID_PATTERN.test(text))
    throw new ClubError('invalid', `${field} must be an IPFS content id`);
  return text;
};

function parseSettings(data: Record<string, unknown>): ClubSettings {
  const line = (field: keyof ClubSettings, max: number) =>
    guard.text(data[field] ?? '', field, max, ONE_LINE_CONTROL_CHARACTERS);
  return {
    name: line('name', 64),
    location: line('location', 64),
    description: guard.text(
      data.description ?? '',
      'description',
      500,
      MULTI_LINE_CONTROL_CHARACTERS
    ),
    photo: cidOrEmpty(data.photo, 'photo'),
    cover: cidOrEmpty(data.cover, 'cover'),
    inviteOnly: bool(data.inviteOnly ?? false, 'inviteOnly'),
    adminsOnlyPost: bool(data.adminsOnlyPost ?? false, 'adminsOnlyPost'),
    showLeaderboard: bool(data.showLeaderboard ?? true, 'showLeaderboard'),
  };
}

function photosOf(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_CLUB_PHOTOS) {
    throw new ClubError('invalid', `photos must be a list of at most ${MAX_CLUB_PHOTOS}`);
  }
  return value.map((p) => {
    if (typeof p !== 'string' || !CID_PATTERN.test(p)) {
      throw new ClubError('invalid', 'each photo must be an IPFS content id');
    }
    return p;
  });
}

/** The latest record per subject: a newer setting, role or request replaces the one before. */
function latestBySubject(records: readonly ClubRecord[]): Map<string, ClubRecord> {
  const latest = new Map<string, ClubRecord>();
  for (const record of records) latest.set(record.subject, record);
  return latest;
}

export interface ClubState {
  clubId: string;
  owner: Address | null;
  settings: ClubSettings;
  admins: Address[];
  removed: Address[];
  requests: Array<{ member: Address; status: RequestStatus; at: number }>;
  events: string[];
}

export interface ClubServiceDeps {
  store: ClubStore;
  chain: ClubChain;
  verify(intent: ClubIntent, signature: string): Promise<boolean>;
  now?: () => number;
}

export function createClubService({ store, chain, verify, now = unixNow }: ClubServiceDeps) {
  const serialize = createSerialQueue();

  async function state(clubId: string): Promise<ClubState> {
    const records = await store.list(clubId, ['settings', 'role', 'removed', 'request', 'event']);
    const byKind = (kind: RecordKind) => records.filter((r) => r.kind === kind);
    const settingsRecord = byKind('settings').at(-1);
    const roles = latestBySubject(byKind('role'));
    const removed = latestBySubject(byKind('removed'));
    const requests = latestBySubject(byKind('request'));
    const events = latestBySubject(byKind('event'));
    return {
      clubId,
      owner: await chain.owner(clubId),
      settings: settingsRecord
        ? { ...DEFAULT_SETTINGS, ...(settingsRecord.data as Partial<ClubSettings>) }
        : DEFAULT_SETTINGS,
      admins: [...roles.values()]
        .filter((r) => r.data.role === 'admin')
        .map((r) => r.subject as Address),
      removed: [...removed.values()]
        .filter((r) => r.data.removed === true)
        .map((r) => r.subject as Address),
      requests: [...requests.values()].map((r) => ({
        member: r.subject as Address,
        status: r.data.status as RequestStatus,
        at: r.createdAt,
      })),
      events: [...events.values()].filter((r) => r.data.linked === true).map((r) => r.subject),
    };
  }

  /** Replaces the latest record of this kind for this subject. */
  async function replace(
    intent: ClubIntent,
    signature: string,
    kind: RecordKind,
    subject: string,
    data: Record<string, unknown>
  ) {
    const old = (await store.list(intent.clubId, [kind])).filter((r) => r.subject === subject);
    const record = await store.add({
      clubId: intent.clubId,
      kind,
      subject,
      author: intent.actor,
      data,
      createdAt: now(),
      clientId: '',
      signature,
      deadline: intent.deadline,
    });
    for (const stale of old) await store.remove(stale.id);
    return record;
  }

  async function requireWriteAllowance(author: Address) {
    if ((await store.countWritesSince(author, now() - DAY_SECONDS)) >= MAX_CLUB_WRITES_PER_DAY) {
      throw new ClubError('rate_limited', 'You have written a lot today; try again tomorrow');
    }
  }

  /** Who is acting and what they may do, worked out once per action. */
  interface Context {
    intent: ClubIntent;
    signature: string;
    data: Record<string, unknown>;
    club: ClubState;
    isOwner: boolean;
    isAdmin: boolean;
    isRemoved: boolean;
  }

  const requireAdmin = (ctx: Context) => {
    if (!ctx.isAdmin) throw new ClubError('forbidden', 'Only club admins can do that');
  };
  const requireActiveMember = async (ctx: Context) => {
    if (ctx.isRemoved) throw new ClubError('forbidden', 'You were removed from this club');
    if (!(await chain.isMember(ctx.intent.clubId, ctx.intent.actor))) {
      throw new ClubError('forbidden', 'Join the club first');
    }
  };
  const memberTarget = (ctx: Context) => guard.address(ctx.intent.target, 'target');
  const requireClientId = (ctx: Context) => {
    if (!CLIENT_ID_PATTERN.test(ctx.intent.clientId)) {
      throw new ClubError('invalid', 'clientId is required');
    }
  };

  /** Stores a post or comment once per client id, within the daily write allowance. */
  async function addWrite(
    ctx: Context,
    kind: 'post' | 'comment',
    subject: string,
    data: Record<string, unknown>
  ) {
    const { intent, signature } = ctx;
    const already = await store.findByClientId(intent.clubId, intent.actor, intent.clientId);
    if (already) return already;
    await requireWriteAllowance(intent.actor);
    return store.add({
      clubId: intent.clubId,
      kind,
      subject,
      author: intent.actor,
      data,
      createdAt: now(),
      clientId: intent.clientId,
      signature,
      deadline: intent.deadline,
    });
  }

  async function post(ctx: Context) {
    await requireActiveMember(ctx);
    const announcement = bool(ctx.data.announcement ?? false, 'announcement');
    if ((ctx.club.settings.adminsOnlyPost || announcement) && !ctx.isAdmin) {
      throw new ClubError('forbidden', 'Only club admins can post here');
    }
    const text = guard.text(
      ctx.data.text ?? '',
      'text',
      MAX_CLUB_POST_LENGTH,
      MULTI_LINE_CONTROL_CHARACTERS
    );
    const photos = photosOf(ctx.data.photos);
    if (!text && photos.length === 0)
      throw new ClubError('invalid', 'a post needs text or a photo');
    requireClientId(ctx);
    const record = await addWrite(ctx, 'post', '', { text, photos, announcement });
    return { post: { ...toPost(record), comments: [] } };
  }

  async function comment(ctx: Context) {
    await requireActiveMember(ctx);
    const parent = await store.find(ctx.intent.target);
    if (!parent || parent.kind !== 'post' || parent.clubId !== ctx.intent.clubId) {
      throw new ClubError('not_found', 'That post is gone');
    }
    const text = guard.text(
      ctx.data.text ?? '',
      'text',
      MAX_CLUB_COMMENT_LENGTH,
      MULTI_LINE_CONTROL_CHARACTERS
    );
    if (!text) throw new ClubError('invalid', 'a comment needs text');
    requireClientId(ctx);
    return { comment: toComment(await addWrite(ctx, 'comment', parent.id, { text })) };
  }

  async function deleteWrite(ctx: Context, kind: 'post' | 'comment') {
    const { intent } = ctx;
    if (!ID_PATTERN.test(intent.target)) throw new ClubError('invalid', 'target is required');
    const record = await store.find(intent.target);
    if (!record || record.kind !== kind || record.clubId !== intent.clubId)
      return { deleted: true as const };
    if (record.author !== intent.actor && !ctx.isAdmin) {
      throw new ClubError('forbidden', 'You can only delete your own posts and comments');
    }
    if (kind === 'post') {
      const replies = (await store.list(intent.clubId, ['comment'])).filter(
        (c) => c.subject === record.id
      );
      for (const reply of replies) await store.remove(reply.id);
    }
    await store.remove(record.id);
    return { deleted: true as const };
  }

  async function setRole(ctx: Context) {
    if (!ctx.isOwner) throw new ClubError('forbidden', 'Only the club owner can change admins');
    const member = memberTarget(ctx);
    if (member === ctx.club.owner) throw new ClubError('invalid', 'The owner is always an admin');
    if (ctx.data.role !== 'admin' && ctx.data.role !== 'member') {
      throw new ClubError('invalid', 'role must be admin or member');
    }
    await replace(ctx.intent, ctx.signature, 'role', member, { role: ctx.data.role });
    return { role: ctx.data.role };
  }

  async function request(ctx: Context) {
    const { intent, club } = ctx;
    if (ctx.isRemoved) throw new ClubError('forbidden', 'You were removed from this club');
    if (await chain.isMember(intent.clubId, intent.actor))
      return { status: 'approved' as RequestStatus };
    const existing = club.requests.find((r) => r.member === intent.actor);
    if (existing && existing.status !== 'declined') return { status: existing.status };
    await replace(intent, ctx.signature, 'request', intent.actor, { status: 'pending' });
    return { status: 'pending' as RequestStatus };
  }

  async function cancelRequest(ctx: Context) {
    const mine = (await store.list(ctx.intent.clubId, ['request'])).filter(
      (r) => r.subject === ctx.intent.actor
    );
    for (const record of mine) await store.remove(record.id);
    return { status: null };
  }

  async function decide(ctx: Context) {
    requireAdmin(ctx);
    const member = memberTarget(ctx);
    const status: RequestStatus = bool(ctx.data.approve, 'approve') ? 'approved' : 'declined';
    const pending = ctx.club.requests.find((r) => r.member === member && r.status === 'pending');
    if (!pending) throw new ClubError('not_found', 'No request to decide');
    await replace(ctx.intent, ctx.signature, 'request', member, { status });
    return { status };
  }

  async function removeMember(ctx: Context) {
    requireAdmin(ctx);
    const member = memberTarget(ctx);
    if (member === ctx.club.owner) throw new ClubError('forbidden', 'The owner cannot be removed');
    const isAdminTarget = ctx.club.admins.includes(member);
    if (isAdminTarget && !ctx.isOwner)
      throw new ClubError('forbidden', 'Only the owner can remove an admin');
    const removed = bool(ctx.data.removed ?? true, 'removed');
    await replace(ctx.intent, ctx.signature, 'removed', member, { removed });
    if (removed && isAdminTarget)
      await replace(ctx.intent, ctx.signature, 'role', member, { role: 'member' });
    return { removed };
  }

  async function linkEvent(ctx: Context, linked: boolean) {
    requireAdmin(ctx);
    if (!CLUB_ID_PATTERN.test(ctx.intent.target))
      throw new ClubError('invalid', 'target must be an event id');
    await replace(ctx.intent, ctx.signature, 'event', ctx.intent.target, { linked });
    return { linked };
  }

  async function notify(ctx: Context) {
    const level = ctx.data.level;
    if (level !== 'all' && level !== 'announcements' && level !== 'off') {
      throw new ClubError('invalid', 'level must be all, announcements or off');
    }
    await replace(ctx.intent, ctx.signature, 'notify', ctx.intent.actor, { level });
    return { level: level as NotifyLevel };
  }

  async function settings(ctx: Context) {
    requireAdmin(ctx);
    const parsed = parseSettings(ctx.data);
    await replace(ctx.intent, ctx.signature, 'settings', '', { ...parsed });
    return { settings: parsed };
  }

  const HANDLERS: Record<ClubAction, (ctx: Context) => Promise<unknown>> = {
    post,
    comment,
    'delete-post': (ctx) => deleteWrite(ctx, 'post'),
    'delete-comment': (ctx) => deleteWrite(ctx, 'comment'),
    settings,
    'set-role': setRole,
    request,
    'cancel-request': cancelRequest,
    decide,
    'remove-member': removeMember,
    'link-event': (ctx) => linkEvent(ctx, true),
    'unlink-event': (ctx) => linkEvent(ctx, false),
    notify,
  };

  async function handle(intent: ClubIntent, signature: string) {
    const data = parseData(intent.data);
    const club = await state(intent.clubId);
    if (!club.owner) throw new ClubError('not_found', 'No such club');
    const isOwner = club.owner === intent.actor;
    return HANDLERS[intent.action]({
      intent,
      signature,
      data,
      club,
      isOwner,
      isAdmin: isOwner || club.admins.includes(intent.actor),
      isRemoved: club.removed.includes(intent.actor),
    });
  }

  return {
    async apply(request: { intent: unknown; signature: string }) {
      const intent = parseIntent(request.intent);
      guard.requireSignature(request.signature);
      guard.requireLiveDeadline(intent.deadline, now());
      await guard.requireValidSignature(verify, intent, request.signature, 'actor');
      return serialize(() => handle(intent, request.signature));
    },

    async state(clubId: unknown) {
      const id = guard.string(clubId, 'clubId');
      if (!CLUB_ID_PATTERN.test(id)) throw new ClubError('invalid', 'clubId must be a number');
      return { club: await state(id) };
    },

    /** Look and settings of several clubs at once, for lists. */
    async settingsFor(clubIds: unknown) {
      if (!Array.isArray(clubIds) || clubIds.length > 100) {
        throw new ClubError('invalid', 'ask about at most 100 clubs at once');
      }
      const ids = [...new Set(clubIds.map((id) => guard.string(id, 'clubId')))].filter((id) =>
        CLUB_ID_PATTERN.test(id)
      );
      const settings: Record<string, ClubSettings> = {};
      for (const id of ids) {
        const latest = (await store.list(id, ['settings'])).at(-1);
        if (latest)
          settings[id] = { ...DEFAULT_SETTINGS, ...(latest.data as Partial<ClubSettings>) };
      }
      return { settings };
    },

    /** The newest posts, each with its comments oldest first. Announcements are marked. */
    async feed(clubId: unknown, limit: unknown) {
      const id = guard.string(clubId, 'clubId');
      if (!CLUB_ID_PATTERN.test(id)) throw new ClubError('invalid', 'clubId must be a number');
      const max =
        typeof limit === 'number' && Number.isInteger(limit) && limit > 0
          ? Math.min(limit, MAX_FEED)
          : 20;
      const records = await store.list(id, ['post', 'comment']);
      const posts = records
        .filter((r) => r.kind === 'post')
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, max);
      const comments = records.filter((r) => r.kind === 'comment');
      return {
        posts: posts.map((post) => ({
          ...toPost(post),
          comments: comments
            .filter((c) => c.subject === post.id)
            .sort((a, b) => a.createdAt - b.createdAt)
            .slice(0, MAX_COMMENTS_PER_POST)
            .map(toComment),
        })),
      };
    },

    /** This member's notification choice for the club; everything until they choose. */
    async notifyLevel(clubId: unknown, member: unknown) {
      const id = guard.string(clubId, 'clubId');
      const who = guard.address(member, 'member');
      const latest = (await store.list(id, ['notify'])).filter((r) => r.subject === who).at(-1);
      return { level: (latest?.data.level as NotifyLevel | undefined) ?? 'all' };
    },
  };
}

function toPost(record: ClubRecord) {
  return {
    id: record.id,
    author: record.author,
    text: String(record.data.text ?? ''),
    photos: Array.isArray(record.data.photos) ? (record.data.photos as string[]) : [],
    announcement: record.data.announcement === true,
    createdAt: record.createdAt,
  };
}

function toComment(record: ClubRecord) {
  return {
    id: record.id,
    postId: record.subject,
    author: record.author,
    text: String(record.data.text ?? ''),
    createdAt: record.createdAt,
  };
}

/** Keeps records in memory; for tests and for running the API without Arkiv. */
export function createMemoryClubStore(): ClubStore {
  const records: ClubRecord[] = [];
  let next = 1;
  return {
    async add(input) {
      const { signature: _signature, deadline: _deadline, ...rest } = input;
      const record = { ...rest, id: `club-${next++}` };
      records.push(record);
      return record;
    },
    find: async (id) => records.find((r) => r.id === id) ?? null,
    async remove(id) {
      const index = records.findIndex((r) => r.id === id);
      if (index >= 0) records.splice(index, 1);
    },
    list: async (clubId, kinds) =>
      records.filter((r) => r.clubId === clubId && kinds.includes(r.kind)),
    findByClientId: async (clubId, author, clientId) =>
      records.find((r) => r.clubId === clubId && r.author === author && r.clientId === clientId) ??
      null,
    countWritesSince: async (author, since) =>
      records.filter(
        (r) =>
          r.author === author && (r.kind === 'post' || r.kind === 'comment') && r.createdAt >= since
      ).length,
  };
}
