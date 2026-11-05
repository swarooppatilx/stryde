import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useHiddenAuthors } from '@/hooks/useHiddenAuthors';
import { useSocialStore } from '@/stores/socialStore';
import { buildInbox, countUnread } from '@/utils/inbox';

export function useInbox() {
  const me = useCurrentUserId();
  const activities = useSocialStore((s) => s.activities);
  const followers = useSocialStore((s) => s.followerEntries);
  const seenAt = useSocialStore((s) => s.inboxSeenAt);

  const hidden = useHiddenAuthors();

  const items = buildInbox({ me, followers, activities: Object.values(activities), hidden });

  return { items, seenAt, unread: countUnread(items, seenAt) };
}
