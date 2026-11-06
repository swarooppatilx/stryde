import { sameAddress } from '@/utils/address';
import { ordinal } from './plural';
import { isVisibleToViewer, type SocialActivity } from './socialSelectors';
import { type WeekStartDay, weekStart } from './trainingLog';

export type LeaderboardView =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'list'; banner: string | null };

/**
 * What the leaderboard screen shows. A failed refresh must not wipe a board that was already
 * loaded: the rows stay and a banner says the refresh failed. Only with nothing to show does the
 * error take over the screen.
 */
export function leaderboardView({
  rows,
  error,
}: {
  rows: readonly unknown[] | null;
  error: string | null;
}): LeaderboardView {
  if (rows === null) return { kind: 'loading' };
  if (rows.length > 0) return { kind: 'list', banner: error };
  return error ? { kind: 'error', message: error } : { kind: 'empty' };
}

/** Where the athlete stands on the board, for people far down a long list; null when they are not on it. */
export function rankSummary(rows: readonly { wallet: string }[], me: string): string | null {
  const index = rows.findIndex((row) => sameAddress(row.wallet, me));
  return index < 0 ? null : `You are ${ordinal(index + 1)} of ${rows.length}`;
}

/** Which board is shown: distance this week or month, or the season's weighted score. */
export type BoardPeriod = 'week' | 'month' | 'season';

export const BOARD_PERIODS: ReadonlyArray<{ value: BoardPeriod; label: string }> = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'season', label: 'Season' },
];

/** Midnight at the start of the athlete's current week (on their chosen first day) or month. */
export function boardPeriodStart(
  period: 'week' | 'month',
  now: Date,
  startsOn: WeekStartDay = 0
): Date {
  if (period === 'week') return weekStart(now, startsOn);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * The activities a week or month board may count: what the viewer could see in the feed, minus
 * simulated-location runs, which never earn credit.
 */
export function countableActivities(
  activities: readonly SocialActivity[],
  viewerId: string,
  following: ReadonlySet<string>
): SocialActivity[] {
  return activities.filter((a) => !a.mocked && isVisibleToViewer(a, viewerId, following));
}

/**
 * The failed-load message for a week or month board, or null. A failed refresh matters when there is
 * nothing cached to count (the board would be a lie) or when a board is on screen (say it may be
 * stale). With activities cached but none in the window, the empty board is the truth.
 */
export function periodBoardError(
  failed: boolean,
  cachedActivities: number,
  boardRows: number
): string | null {
  if (!failed) return null;
  if (cachedActivities > 0 && boardRows === 0) return null;
  return 'Could not load activities. Pull down to try again.';
}
