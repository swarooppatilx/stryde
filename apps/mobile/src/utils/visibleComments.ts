import { withoutReportedIds } from '@/utils/reporting';
import { withoutHidden } from '@/utils/withoutHidden';

/** The comments the athlete should see: not ones they reported, and not ones by authors they blocked or muted. */
export function visibleComments<T extends { id: string; userId: string }>(
  comments: T[],
  reportedIds: readonly string[],
  hiddenAuthors: ReadonlySet<string>
): T[] {
  return withoutHidden(
    withoutReportedIds(comments, (c) => c.id, reportedIds),
    (c) => c.userId,
    hiddenAuthors
  );
}
