import { querySubgraph, shortAddress, subgraphUrl } from './subgraph';

export interface ActivityRow {
  activityId: string;
  activityType: number;
  distance: string; // meters
  duration: string; // milliseconds
  territoryArea: string; // m²
  timestamp: string; // unix seconds
  metadataCid: string | null;
  user: { id: string; username: string };
  kudos: Array<{ id: string }>;
  comments: Array<{ id: string }>;
}

export interface ActivityPost {
  id: string;
  athleteName: string;
  athleteInitials: string;
  timeAgo: string;
  title: string;
  distance: string;
  duration: string;
  pace: string;
  territoryClaimed: string | null;
  kudosCount: number;
  commentsCount: number;
}

// Same ids as the contract and `ACTIVITY_TYPE_BY_ID` in @repo/shared.
const SPORT_BY_ID: Record<number, string> = {
  0: 'Run',
  1: 'Ride',
  2: 'Walk',
  3: 'Hike',
  4: 'Swim',
  5: 'Yoga',
  6: 'Workout',
  7: 'HIIT',
  8: 'Dance',
  9: 'Climb',
  10: 'Skate',
  11: 'Row',
};
/** Rides and skating are told in speed, everything else in pace (as in the app). */
const SPEED_SPORTS = new Set([1, 10]);

const GATEWAY = 'https://gateway.pinata.cloud/ipfs';
const METADATA_TIMEOUT_MS = 4000;
const MAX_POSTS = 12;

export function timeAgo(timestampSeconds: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor(nowMs / 1000) - timestampSeconds);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function paceOrSpeed(typeId: number, meters: number, ms: number): string {
  if (meters <= 0 || ms <= 0) return '—';
  if (SPEED_SPORTS.has(typeId)) return `${(meters / 1000 / (ms / 3_600_000)).toFixed(1)} km/h`;
  const secondsPerKm = ms / 1000 / (meters / 1000);
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.floor(secondsPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

/** Recent activities as cards. `names` maps a metadata CID to the name the athlete gave the activity. */
export function toPosts(
  rows: readonly ActivityRow[],
  names: ReadonlyMap<string, string>,
  nowMs: number
): ActivityPost[] {
  return rows.map((row) => {
    const meters = Number(row.distance);
    const athleteName = row.user.username || shortAddress(row.user.id);
    const area = Number(row.territoryArea);
    return {
      id: row.activityId,
      athleteName,
      athleteInitials: athleteName.slice(0, 2).toUpperCase(),
      timeAgo: timeAgo(Number(row.timestamp), nowMs),
      title:
        (row.metadataCid && names.get(row.metadataCid)) ||
        SPORT_BY_ID[row.activityType] ||
        'Activity',
      distance: `${(meters / 1000).toFixed(2)} km`,
      duration: formatDuration(Number(row.duration)),
      pace: paceOrSpeed(row.activityType, meters, Number(row.duration)),
      territoryClaimed: area > 0 ? `+${Math.round(area).toLocaleString('en-US')} m² claimed` : null,
      kudosCount: row.kudos.length,
      commentsCount: row.comments.length,
    };
  });
}

/** The name an athlete gave an activity, from its pinned metadata; null if unreachable. */
async function fetchName(cid: string): Promise<string | null> {
  try {
    const response = await fetch(`${GATEWAY}/${cid}`, {
      signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const metadata = (await response.json()) as { name?: unknown };
    return typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim() : null;
  } catch {
    return null;
  }
}

/** The latest activities straight from the subgraph; null when it can't be reached. */
export async function fetchRecentPosts(url = subgraphUrl()): Promise<ActivityPost[] | null> {
  try {
    const { activities } = await querySubgraph<{ activities: ActivityRow[] }>(
      url,
      `{ activities(first: ${MAX_POSTS}, orderBy: timestamp, orderDirection: desc) {
        activityId activityType distance duration territoryArea timestamp metadataCid
        user { id username }
        kudos(first: 1000, where: { active: true }) { id }
        comments(first: 1000) { id }
      } }`
    );
    const cids = [...new Set(activities.flatMap((a) => (a.metadataCid ? [a.metadataCid] : [])))];
    const names = new Map<string, string>();
    await Promise.all(
      cids.map(async (cid) => {
        const name = await fetchName(cid);
        if (name) names.set(cid, name);
      })
    );
    return toPosts(activities, names, Date.now());
  } catch {
    return null;
  }
}
