import { formatMemberCount } from '@/utils/format';

// Club rows count "runners" / "cyclists" rather than a generic "members". Sports without
// an everyday noun fall back to "members" instead of inventing one.
const NOUN: Record<string, [one: string, many: string]> = {
  run: ['runner', 'runners'],
  ride: ['cyclist', 'cyclists'],
  walk: ['walker', 'walkers'],
  hike: ['hiker', 'hikers'],
  swim: ['swimmer', 'swimmers'],
};

export function memberNoun(sport: string, count: number): string {
  const [one, many] = NOUN[sport] ?? ['member', 'members'];
  return count === 1 ? one : many;
}

export function clubRowSubtitle(club: {
  sportType: string;
  memberCount: number;
  location: string;
}): string {
  const count = `${formatMemberCount(club.memberCount)} ${memberNoun(club.sportType, club.memberCount)}`;
  return club.location ? `${count} • ${club.location}` : count;
}
