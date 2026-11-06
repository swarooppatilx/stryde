import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/button';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { UserAvatar } from '@/components/user-avatar';
import { getSportIcon, getSportLabel } from '@/constants/activity';
import { IconSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useEnsName } from '@/hooks/useEnsName';
import { useSocialUser } from '@/hooks/useSocialUser';
import { useSocialStore } from '@/stores/socialStore';
import type { Activity } from '@/types';
import { isStatHidden } from '@/utils/activityStats';
import { athleteFollowPill } from '@/utils/athleteFollowPill';
import { confirmUnfollow } from '@/utils/confirmUnfollow';
import { formatWhen } from '@/utils/dates';
import { feedSubtext } from '@/utils/feedSubtext';

interface Props {
  activity: Activity;
  isOwner: boolean;
}

/** Whose activity this is: avatar, name, then when, what and where, with a Follow pill. Only for other athletes. */
export function ActivityAthleteRow({ activity, isOwner }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const user = useSocialUser(activity.userId);
  const ensName = useEnsName(user?.wallet);
  const isFollowing = useSocialStore((s) => s.following.has(activity.userId.toLowerCase()));
  const toggleFollow = useSocialStore((s) => s.toggleFollow);
  const pill = athleteFollowPill({ isOwner, isFollowing });
  if (!user || !pill) return null;

  const name = ensName || user.username;
  const startedAt = activity.stream?.startedAt ?? activity.createdAt;
  const subtext = feedSubtext({
    when: formatWhen(startedAt, isStatHidden('start_time', activity.hiddenStats, isOwner)),
    sport: getSportLabel(activity.activityType),
    place: user.location,
    manual: activity.isManual,
    imported: activity.isImported,
  });
  const onFollow = () => {
    const run = () => void toggleFollow(user.id);
    if (isFollowing) confirmUnfollow(name, run);
    else run();
  };

  return (
    <View style={styles.row}>
      <Tappable
        onPress={() => router.push(`/athletes/${user.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${name}'s profile`}
        style={styles.athlete}
      >
        <UserAvatar name={name} uri={user.avatar} size="md" />
        <View style={styles.text}>
          <ThemedText type="sectionTitle" numberOfLines={1}>
            {name}
          </ThemedText>
          <View style={styles.subtextRow}>
            <Ionicons
              name={getSportIcon(activity.activityType)}
              size={IconSize.badge}
              color={theme.textSecondary}
            />
            <ThemedText
              type="caption"
              themeColor="textSecondary"
              numberOfLines={2}
              style={styles.subtext}
            >
              {subtext}
            </ThemedText>
          </View>
        </View>
      </Tappable>
      <AppButton
        size="small"
        fullWidth={false}
        variant={pill === 'follow' ? 'primary' : 'secondary'}
        onPress={onFollow}
        accessibilityLabel={pill === 'follow' ? `Follow ${name}` : `Unfollow ${name}`}
      >
        {pill === 'follow' ? 'Follow' : 'Following'}
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  athlete: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  text: { flex: 1, gap: Spacing.half },
  subtextRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  subtext: { flexShrink: 1 },
});
