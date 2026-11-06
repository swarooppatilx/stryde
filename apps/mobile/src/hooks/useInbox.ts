import { useMemo } from 'react';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useHiddenAuthors } from '@/hooks/useHiddenAuthors';
import { useActivityStore } from '@/stores/activityStore';
import { useClubStore } from '@/stores/clubStore';
import { useCommunityStore } from '@/stores/communityStore';
import { useSocialStore } from '@/stores/socialStore';
import { achievementsEarnedBy } from '@/utils/achievements';
import { sameAddress } from '@/utils/address';
import { buildInbox, countUnread } from '@/utils/inbox';

export function useInbox() {
  const me = useCurrentUserId();
  const activities = useSocialStore((s) => s.activities);
  const followers = useSocialStore((s) => s.followerEntries);
  const seenAt = useSocialStore((s) => s.inboxSeenAt);
  const joinedClubIds = useCommunityStore((s) => s.joinedClubIds);
  const clubList = useCommunityStore((s) => s.clubs);
  const clubViews = useClubStore((s) => s.clubs);
  const events = useCommunityStore((s) => s.events);
  const joinedEvents = useCommunityStore((s) => s.joinedEvents);
  const myActivities = useActivityStore((s) => s.activities);

  const hidden = useHiddenAuthors();

  const clubs = useMemo(
    () =>
      joinedClubIds.flatMap((id) => {
        const view = clubViews[id];
        if (!view?.state) return [];
        const name = clubList.find((c) => c.id === id)?.name ?? view.state.settings.name;
        const managedByMe =
          (view.state.owner !== null && sameAddress(view.state.owner, me)) ||
          view.state.admins.some((admin) => sameAddress(admin, me));
        return [{ id, name, managedByMe, requests: view.state.requests, posts: view.feed }];
      }),
    [joinedClubIds, clubViews, clubList, me]
  );

  const joinedEventList = useMemo(
    () => events.filter((e) => joinedEvents.includes(e.id)),
    [events, joinedEvents]
  );

  const milestones = useMemo(
    () =>
      [...achievementsEarnedBy(myActivities)].flatMap(([activityId, earned]) => {
        const activity = myActivities.find((a) => a.id === activityId);
        if (!activity) return [];
        return earned.map((a) => ({
          id: `${a.id}`,
          title: a.title,
          at: new Date(activity.createdAt),
        }));
      }),
    [myActivities]
  );

  const items = buildInbox({
    me,
    followers,
    activities: Object.values(activities),
    hidden,
    clubs,
    events: joinedEventList,
    milestones,
  });

  return { items, seenAt, unread: countUnread(items, seenAt) };
}
