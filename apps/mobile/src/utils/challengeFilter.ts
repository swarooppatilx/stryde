import { sameAddress } from '@/utils/address';

export type ChallengeFilter = 'all' | 'needs-you' | 'active' | 'done';

export const CHALLENGE_FILTERS: readonly { value: ChallengeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'needs-you', label: 'Needs you' },
  { value: 'active', label: 'Active' },
  { value: 'done', label: 'Done' },
];

/** What the contract's status numbers mean, in the order it reports them. */
export const CHALLENGE_STATUS_LABEL = ['Open', 'Accepted', 'Settled', 'Cancelled'];

type StatusColor = 'accentText' | 'warningText' | 'successText' | 'textSecondary';

const STATUS_COLOR: StatusColor[] = ['accentText', 'warningText', 'successText', 'textSecondary'];

/** The theme colour a status reads in: live ones warm, a settled one green, a cancelled one muted. */
export function challengeStatusColor(status: number): StatusColor {
  return STATUS_COLOR[status] ?? 'accentText';
}

interface FilterInput {
  status: number;
  challenger: string;
  opponent: string;
}

export function matchesChallengeFilter(
  challenge: FilterInput,
  filter: ChallengeFilter,
  me: string | undefined
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'needs-you':
      // Sent to me, still open: waiting for me to accept.
      return (
        challenge.status === 0 &&
        sameAddress(challenge.opponent, me) &&
        !sameAddress(challenge.challenger, me)
      );
    case 'active':
      return challenge.status === 0 || challenge.status === 1;
    case 'done':
      return challenge.status === 2 || challenge.status === 3;
  }
}

/** Challenges as the list shows them: waiting on you, then live, then finished; the given order within each. */
export function orderChallenges<T extends FilterInput>(
  challenges: readonly T[],
  me: string | undefined
): T[] {
  const rank = (c: T) => {
    if (matchesChallengeFilter(c, 'needs-you', me)) return 0;
    if (matchesChallengeFilter(c, 'active', me)) return 1;
    return 2;
  };
  return challenges
    .map((c, index) => ({ c, index }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.index - b.index)
    .map(({ c }) => c);
}

/** How long a live challenge has left, in words; null once it is settled or cancelled, or with no deadline. */
export function challengeTimeLeft(
  deadlineSeconds: number,
  status: number,
  now: Date
): string | null {
  if ((status !== 0 && status !== 1) || deadlineSeconds <= 0) return null;
  const deadline = new Date(deadlineSeconds * 1000);
  if (deadline.getTime() < now.getTime()) return 'Deadline passed';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(deadline) - startOfDay(now)) / 86_400_000);
  return days <= 0 ? 'Ends today' : `${days} ${days === 1 ? 'day' : 'days'} left`;
}
