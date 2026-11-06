import { sameAddress } from './address';

/** `mention` is reserved for the protocol wave: nothing produces it yet, and no screen lists it. */
export type InboxKind =
  | 'follow'
  | 'comment'
  | 'kudos'
  | 'club_post'
  | 'club_request'
  | 'club_approved'
  | 'event_reminder'
  | 'milestone'
  | 'mention';

/** What the filter chips group the kinds by. */
export type InboxGroup =
  | 'follow'
  | 'kudos'
  | 'comment'
  | 'club'
  | 'event'
  | 'milestone'
  | 'mention';

export interface InboxItem {
  id: string;
  kind: InboxKind;
  /** Who did it; absent for items about the athlete's own progress or an upcoming event. */
  actorId?: string;
  at: Date;
  activityId?: string;
  clubId?: string;
  eventId?: string;
  /** The club, event or badge the item is about. */
  title?: string;
  /** When an event starts, for its reminder. */
  startsAt?: Date;
  text?: string;
}

export function inboxGroupOf(kind: InboxKind): InboxGroup {
  switch (kind) {
    case 'club_post':
    case 'club_request':
    case 'club_approved':
      return 'club';
    case 'event_reminder':
      return 'event';
    default:
      return kind;
  }
}

export const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;
export const MILESTONE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

interface ClubInput {
  id: string;
  name: string;
  /** The athlete owns the club or is one of its admins, so join requests are theirs to decide. */
  managedByMe: boolean;
  /** Unix seconds throughout, as the club service reports them. */
  requests: ReadonlyArray<{ member: string; status: string; at: number }>;
  posts: ReadonlyArray<{ id: string; author: string; createdAt: number }>;
}

interface InboxInput {
  me: string;
  followers: ReadonlyArray<{ address: string; followedAt: number }>;
  /** Lower-case wallets the athlete blocked or muted: nothing from them is listed. */
  hidden?: ReadonlySet<string>;
  activities: ReadonlyArray<{
    id: string;
    userId: string;
    comments: ReadonlyArray<{ id: string; userId: string; text: string; createdAt: Date }>;
    /** Who gave kudos, and when (unix seconds, keyed by lower-case wallet). */
    kudos?: readonly string[];
    kudosAt?: Readonly<Record<string, number>>;
  }>;
  /** Clubs the athlete belongs to or runs, as far as they have been loaded. */
  clubs?: readonly ClubInput[];
  /** Events the athlete joined. */
  events?: ReadonlyArray<{ id: string; title: string; startDate: Date; endDate: Date }>;
  /** Badges the athlete earned, with when. */
  milestones?: ReadonlyArray<{ id: string; title: string; at: Date }>;
  /** Milliseconds; defaults to the phone clock, which only decides what is already due. */
  now?: number;
}

/** Only events with a time are listed: without one they cannot be ordered or marked unread. */
export function buildInbox({
  me,
  followers,
  activities,
  hidden,
  clubs = [],
  events = [],
  milestones = [],
  now = Date.now(),
}: InboxInput): InboxItem[] {
  const isHidden = (address: string) => hidden?.has(address.toLowerCase()) ?? false;
  const follows = followers
    .filter((f) => f.followedAt > 0 && !isHidden(f.address))
    .map<InboxItem>((f) => ({
      id: `follow:${f.address.toLowerCase()}`,
      kind: 'follow',
      actorId: f.address,
      at: new Date(f.followedAt * 1000),
    }));

  const comments = activities
    .filter((a) => sameAddress(a.userId, me))
    .flatMap((a) =>
      a.comments
        .filter((c) => !sameAddress(c.userId, me) && !isHidden(c.userId))
        .map<InboxItem>((c) => ({
          id: `comment:${c.id}`,
          kind: 'comment',
          actorId: c.userId,
          at: new Date(c.createdAt),
          activityId: a.id,
          text: c.text,
        }))
    );

  const kudos = activities
    .filter((a) => sameAddress(a.userId, me))
    .flatMap((a) =>
      (a.kudos ?? []).flatMap<InboxItem>((giver) => {
        const givenAt = a.kudosAt?.[giver.toLowerCase()] ?? 0;
        if (givenAt <= 0 || sameAddress(giver, me) || isHidden(giver)) return [];
        return [
          {
            id: `kudos:${a.id}:${giver.toLowerCase()}`,
            kind: 'kudos',
            actorId: giver,
            at: new Date(givenAt * 1000),
            activityId: a.id,
          },
        ];
      })
    );

  const clubItems = clubs.flatMap<InboxItem>((club) => [
    ...club.posts
      .filter((p) => p.createdAt > 0 && !sameAddress(p.author, me) && !isHidden(p.author))
      .map<InboxItem>((p) => ({
        id: `club-post:${club.id}:${p.id}`,
        kind: 'club_post',
        actorId: p.author,
        at: new Date(p.createdAt * 1000),
        clubId: club.id,
        title: club.name,
      })),
    ...(club.managedByMe
      ? club.requests
          .filter((r) => r.status === 'pending' && r.at > 0 && !isHidden(r.member))
          .map<InboxItem>((r) => ({
            id: `club-request:${club.id}:${r.member.toLowerCase()}`,
            kind: 'club_request',
            actorId: r.member,
            at: new Date(r.at * 1000),
            clubId: club.id,
            title: club.name,
          }))
      : []),
    ...club.requests
      .filter((r) => r.status === 'approved' && r.at > 0 && sameAddress(r.member, me))
      .map<InboxItem>((r) => ({
        id: `club-approved:${club.id}`,
        kind: 'club_approved',
        at: new Date(r.at * 1000),
        clubId: club.id,
        title: club.name,
      })),
  ]);

  const reminders = events
    .filter((e) => e.endDate.getTime() > now && e.startDate.getTime() - REMINDER_LEAD_MS <= now)
    .map<InboxItem>((e) => ({
      id: `event-reminder:${e.id}`,
      kind: 'event_reminder',
      at: new Date(Math.min(now, Math.max(e.startDate.getTime() - REMINDER_LEAD_MS, 0))),
      eventId: e.id,
      title: e.title,
      startsAt: e.startDate,
    }));

  const badges = milestones
    .filter((m) => m.at.getTime() <= now && now - m.at.getTime() <= MILESTONE_WINDOW_MS)
    .map<InboxItem>((m) => ({
      id: `milestone:${m.id}`,
      kind: 'milestone',
      at: m.at,
      title: m.title,
    }));

  return [...follows, ...comments, ...kudos, ...clubItems, ...reminders, ...badges].sort(
    (a, b) => b.at.getTime() - a.at.getTime()
  );
}

export function countUnread(items: readonly InboxItem[], seenAtMs: number): number {
  return items.filter((i) => i.at.getTime() > seenAtMs).length;
}

export function unreadByGroup(
  items: readonly InboxItem[],
  seenAtMs: number
): Partial<Record<InboxGroup, number>> {
  const counts: Partial<Record<InboxGroup, number>> = {};
  for (const item of items) {
    if (item.at.getTime() <= seenAtMs) continue;
    const group = inboxGroupOf(item.kind);
    counts[group] = (counts[group] ?? 0) + 1;
  }
  return counts;
}

/** The groups that have at least one item, in the order they first appear (newest first). */
export function groupsPresent(items: readonly InboxItem[]): InboxGroup[] {
  return [...new Set(items.map((i) => inboxGroupOf(i.kind)))];
}

/** Marking everything read means treating the newest item's own time as seen. */
export function readAllCutoff(items: readonly InboxItem[], current: number): number {
  return Math.max(current, items[0]?.at.getTime() ?? 0);
}
