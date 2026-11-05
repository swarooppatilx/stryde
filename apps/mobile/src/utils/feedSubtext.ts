interface FeedSubtextInput {
  when: string;
  sport: string;
  place?: string;
  manual?: boolean;
}

/** The small lines under an athlete's name in the feed: when, then what and where. */
export function feedSubtext({ when, sport, place, manual }: FeedSubtextInput): string {
  const parts = [sport];
  const trimmed = place?.trim();
  if (trimmed) parts.push(trimmed);
  if (manual) parts.push('Manual entry');
  return `${when}\n${parts.join(' · ')}`;
}
