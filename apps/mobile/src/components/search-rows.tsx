import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { FollowButton } from '@/components/follow-button';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { UserAvatar } from '@/components/user-avatar';
import { SPORT_ICONS } from '@/constants/activity';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getDisplayName } from '@/utils/format';
import type { RecentSearch } from '@/utils/recentSearches';
import type { SocialActivity, SocialUser } from '@/utils/socialSelectors';

const ROW_PADDING = Spacing.three;

export function PersonRow({
  user,
  showFollow,
  onPress,
  tag,
}: {
  user: SocialUser;
  showFollow: boolean;
  onPress: () => void;
  /** A small word after the name, e.g. "Owner". */
  tag?: string;
}) {
  const theme = useTheme();
  const name = getDisplayName(user);
  return (
    <View style={styles.row}>
      <Tappable
        style={styles.rowMain}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}, @${user.username}`}
      >
        <UserAvatar uri={user.avatar} name={name} size={40} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
              {name}
            </ThemedText>
            {tag ? (
              <ThemedText type="caption" themeColor="textSecondary">
                {tag}
              </ThemedText>
            ) : null}
            {user.isVerified && (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={Brand.verified}
                accessibilityLabel="Verified account"
              />
            )}
          </View>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {user.location || `@${user.username}`}
          </ThemedText>
        </View>
      </Tappable>
      {showFollow && <FollowButton userId={user.id} name={name} />}
      <View style={[styles.separator, { backgroundColor: theme.border }]} />
    </View>
  );
}

export function ActivityRow({
  activity,
  detail,
  onPress,
}: {
  activity: SocialActivity;
  detail: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const icon = (SPORT_ICONS[activity.activityType] || 'walk') as keyof typeof Ionicons.glyphMap;
  return (
    <View style={styles.row}>
      <Tappable
        style={styles.rowMain}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${activity.name}, ${detail}`}
      >
        <View style={[styles.activityIcon, { backgroundColor: theme.brand.primaryTint }]}>
          <Ionicons name={icon} size={18} color={theme.brand.primary} />
        </View>
        <View style={styles.info}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {activity.name}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {detail}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      </Tappable>
      <View style={[styles.separator, { backgroundColor: theme.border }]} />
    </View>
  );
}

export function RecentRow({
  entry,
  onPress,
  onRemove,
}: {
  entry: RecentSearch;
  onPress: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Tappable
        style={styles.rowMain}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Recent search, ${entry.label}`}
      >
        <View style={[styles.activityIcon, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons
            name={entry.kind === 'user' ? 'person-outline' : 'time-outline'}
            size={18}
            color={theme.textSecondary}
          />
        </View>
        <ThemedText type="small" numberOfLines={1} style={styles.name}>
          {entry.label}
        </ThemedText>
      </Tappable>
      <Tappable
        onPress={onRemove}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${entry.label} from recent searches`}
      >
        <Ionicons name="close" size={18} color={theme.textSecondary} />
      </Tappable>
      <View style={[styles.separator, { backgroundColor: theme.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: ROW_PADDING,
    minHeight: 60,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
    paddingVertical: Spacing.two,
  },
  info: { flex: 1, gap: Spacing.half },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  name: { flexShrink: 1 },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    left: ROW_PADDING + 40 + Spacing.twoHalf,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});
