interface FeedSubtextInput {
  when: string;
  sport: string;
  place?: string;
  manual?: boolean;
  /** From a file or another app: says so instead of "Manual entry", (naming a source rather than a method). */
  imported?: boolean;
}

/** The small lines under an athlete's name in the feed: when, then what and where. */
export function feedSubtext({ when, sport, place, manual, imported }: FeedSubtextInput): string {
  const parts = [sport];
  const trimmed = place?.trim();
  if (trimmed) parts.push(trimmed);
  if (imported) parts.push('Imported');
  else if (manual) parts.push('Manual entry');
  return `${when}\n${parts.join(' · ')}`;
}
