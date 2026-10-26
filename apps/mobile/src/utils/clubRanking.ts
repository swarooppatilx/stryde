export interface RankedMember {
  userId: string;
  distance: number;
  count: number;
}

interface ActivityLike {
  userId: string;
  distance: number;
  createdAt: Date;
}

/** Everyone who has been out since `since`, furthest first; pass `include` to rank only some athletes. */
export function rankByDistance(
  activities: readonly ActivityLike[],
  since: Date,
  include?: (userId: string) => boolean
): RankedMember[] {
  const sinceMs = since.getTime();
  const totals = new Map<string, RankedMember>();

  for (const activity of activities) {
    const key = activity.userId.toLowerCase();
    if (include && !include(key)) continue;
    if (new Date(activity.createdAt).getTime() < sinceMs) continue;
    const row = totals.get(key) ?? { userId: key, distance: 0, count: 0 };
    row.distance += activity.distance;
    row.count += 1;
    totals.set(key, row);
  }

  return [...totals.values()]
    .filter((row) => row.distance > 0)
    .sort(
      (a, b) => b.distance - a.distance || b.count - a.count || a.userId.localeCompare(b.userId)
    );
}

/** Club members ranked by distance over the last `days` days: those who have been out, furthest first. */
export function rankClubMembers(
  members: readonly string[],
  activities: readonly ActivityLike[],
  now: Date,
  days: number
): RankedMember[] {
  const inClub = new Set(members.map((m) => m.toLowerCase()));
  return rankByDistance(activities, new Date(now.getTime() - days * 86_400_000), (key) =>
    inClub.has(key)
  );
}
