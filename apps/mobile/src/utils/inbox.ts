import { sameAddress } from './address';

export interface InboxItem {
  id: string;
  kind: 'follow' | 'comment' | 'kudos';
  actorId: string;
  at: Date;
  activityId?: string;
  text?: string;
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
}

/** Only events with a time are listed: without one they cannot be ordered or marked unread. */
export function buildInbox({ me, followers, activities, hidden }: InboxInput): InboxItem[] {
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

  return [...follows, ...comments, ...kudos].sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function countUnread(items: readonly InboxItem[], seenAtMs: number): number {
  return items.filter((i) => i.at.getTime() > seenAtMs).length;
}
