import type { SportFilter } from '@/components/filter-chips';

/** Whether something done in `sport` shows under the chosen chip: All and Multi show everything. */
export function matchesSportFilter(filter: SportFilter, sport: string | undefined): boolean {
  if (filter === 'all' || filter === 'multi') return true;
  return sport === filter;
}
