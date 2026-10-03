import type { SyncedComment, services } from '@repo/shared';
import type { SocialActivity, SocialComment } from '@/stores/socialStore';
import type { Activity } from '@/types';
import { sameAddress } from './address';

export function activityKey(activities: Record<string, SocialActivity>, id: string): string {
  if (activities[id]) return id;
  const lower = id.toLowerCase();
  if (activities[lower]) return lower;
  const match = Object.entries(activities).find(
    ([, a]) => a.id === id || a.activityHash?.toLowerCase() === lower
  );
  return match ? match[0] : id;
}

export function mergeLocalActivities(
  activities: Record<string, SocialActivity>,
  localActivities: Activity[]
): Record<string, SocialActivity> {
  const merged: Record<string, SocialActivity> = {};
  for (const activity of Object.values(activities)) {
    merged[(activity.activityHash || activity.id).toLowerCase()] = activity;
  }
  for (const local of localActivities) {
    const key = (local.activityHash || local.id).toLowerCase();
    const existing = merged[key];
    merged[key] = {
      ...existing,
      ...local,
      activityId: existing?.activityId ?? local.onchainActivityId,
      // A synced local copy can have blank route/name fields while the chain record has them from IPFS metadata; blanks must not win.
      name: local.name || existing?.name,
      polyline: local.polyline || existing?.polyline || '',
      territory: local.territory || existing?.territory || null,
      kudos: existing?.kudos ?? local.kudos ?? [],
      comments: existing?.comments ?? local.comments ?? [],
    };
  }
  return merged;
}

interface FeedInput {
  chain: readonly services.sync.SyncedActivity[];
  /** This device's own activities, which win for what the user typed and chose. */
  local: readonly Activity[];
  /** The feed as it stands, for interactions the chain hasn't caught up with. */
  existing: Record<string, SocialActivity>;
  social: {
    kudos: ReadonlyArray<{ activityId: bigint; giver: string; timestamp?: number }>;
    comments: readonly SyncedComment[];
  };
  me: string;
}

/** Chain activities as feed posts, with their kudos and comments attached. */
export function feedFromChain({ chain, local, existing, social, me }: FeedInput): {
  activities: SocialActivity[];
  /** Hashes of the posts the viewer has given kudos to. */
  myKudos: Set<string>;
} {
  const viewer = me.toLowerCase();
  const localByHash = new Map(
    local.flatMap((a) => (a.activityHash ? [[a.activityHash, a] as const] : []))
  );
  const existingByHash = new Map(Object.values(existing).map((a) => [a.activityHash || a.id, a]));

  const kudosById = new Map<string, Set<string>>();
  const kudosTimes = new Map<string, Record<string, number>>();
  for (const k of social.kudos) {
    const key = k.activityId.toString();
    const giver = k.giver.toLowerCase();
    const givers = kudosById.get(key) ?? new Set<string>();
    givers.add(giver);
    kudosById.set(key, givers);
    if (k.timestamp) kudosTimes.set(key, { ...kudosTimes.get(key), [giver]: k.timestamp });
  }
  // A comment's likes come from the likes service, not the chain: carry them over so a re-sync does not wipe them.
  const knownLikes = new Map(
    Object.values(existing).flatMap((a) => a.comments.map((c) => [c.id, c.likedBy] as const))
  );
  const commentsById = new Map<string, SocialComment[]>();
  for (const c of social.comments) {
    const key = c.activityId.toString();
    const list = commentsById.get(key) ?? [];
    list.push({
      id: c.id,
      userId: c.author,
      text: c.text ?? '',
      createdAt: new Date(c.createdAt * 1000),
      likedBy: knownLikes.get(c.id) ?? [],
    });
    commentsById.set(key, list);
  }

  const myKudos = new Set<string>();
  const activities = chain.map((a): SocialActivity => {
    const mine = localByHash.get(a.activityHash);
    const previous = existingByHash.get(a.activityHash);
    const id = a.activityId.toString();

    const chainKudos = kudosById.get(id);
    const kudos = chainKudos ? [...chainKudos] : [];
    // A kudos still on its way to the chain: keep it rather than flicker it off.
    if (!chainKudos && previous?.kudos.includes(viewer) && previous.kudos.length <= 1) {
      kudos.push(viewer);
    }
    if (kudos.includes(viewer)) myKudos.add(a.activityHash);

    const seen = new Set<string>();
    const comments = [...(commentsById.get(id) ?? []), ...(previous?.comments ?? [])].filter(
      (c) => !seen.has(c.id) && seen.add(c.id)
    );

    return {
      id: a.activityHash,
      userId: a.owner,
      name: mine?.name ?? a.metadataName,
      activityType: mine?.activityType ?? a.activityType,
      distance: mine?.distance ?? a.distance,
      duration: mine?.duration ?? a.duration,
      polyline: mine?.polyline || a.metadataPolyline || '',
      territory: mine?.territory || a.metadataTerritory || null,
      territoryArea: mine?.territoryArea ?? a.territoryArea,
      description: mine?.description ?? a.metadataDescription,
      feel: mine?.feel,
      privacy: mine?.privacy,
      image: mine?.image ?? a.metadataPhotos?.[0],
      images: mine?.images ?? a.metadataPhotos,
      isManual: mine?.isManual,
      activityHash: a.activityHash,
      txHash: mine?.txHash,
      metadataCid: mine?.metadataCid ?? a.metadataCid,
      createdAt: mine?.createdAt ?? new Date(a.timestamp * 1000),
      activityId: id,
      kudos,
      kudosAt: kudosTimes.get(id),
      comments,
    };
  });

  return { activities, myKudos };
}

export const FEED_SCOPES = ['Everyone', 'Following', 'You'] as const;
export type FeedScope = (typeof FEED_SCOPES)[number];

/** Narrows an already-visible feed to everyone, the athletes you follow, or just you. */
export function filterFeed(
  activities: SocialActivity[],
  scope: FeedScope,
  viewerId: string,
  following: ReadonlySet<string>
): SocialActivity[] {
  switch (scope) {
    case 'Everyone':
      return activities;
    case 'Following':
      // Your own activities belong in the feed of the people you follow.
      return activities.filter(
        (a) => following.has(a.userId.toLowerCase()) || sameAddress(a.userId, viewerId)
      );
    case 'You':
      return activities.filter((a) => sameAddress(a.userId, viewerId));
  }
}

/** One comment, with the viewer's like added or removed; the original is left alone. */
export function withCommentLike(
  activities: Record<string, SocialActivity>,
  activityId: string,
  commentId: string,
  userId: string,
  liked: boolean
): Record<string, SocialActivity> {
  const key = activityKey(activities, activityId);
  const activity = activities[key];
  if (!activity) return activities;
  return {
    ...activities,
    [key]: {
      ...activity,
      comments: activity.comments.map((comment) => {
        if (comment.id !== commentId) return comment;
        const others = (comment.likedBy ?? []).filter((id) => !sameAddress(id, userId));
        return { ...comment, likedBy: liked ? [...others, userId] : others };
      }),
    },
  };
}

/**
 * Sets each comment's likes to what the likes service reports. Comments it said nothing about (one still
 * being posted) are left as they are, and nothing changes object identity if nothing changed.
 */
export function applyCommentLikes(
  activities: Record<string, SocialActivity>,
  likes: Record<string, readonly string[]>
): Record<string, SocialActivity> {
  let changed = false;
  const next: Record<string, SocialActivity> = {};
  for (const [key, activity] of Object.entries(activities)) {
    let activityChanged = false;
    const comments = activity.comments.map((comment) => {
      const known = likes[comment.id];
      if (!known) return comment;
      const current = comment.likedBy ?? [];
      if (current.length === known.length && current.every((id, i) => id === known[i])) {
        return comment;
      }
      activityChanged = true;
      return { ...comment, likedBy: [...known] };
    });
    next[key] = activityChanged ? { ...activity, comments } : activity;
    changed ||= activityChanged;
  }
  return changed ? next : activities;
}
