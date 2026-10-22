import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { SPORT_ICONS } from '@/constants/activity';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Activity, ActivityPrivacy } from '@/types';
import { formatWeekdayDay } from '@/utils/dates';
import { formatDistance, formatDuration, type UnitSystem } from '@/utils/format';

const PRIVACY_ICON: Record<ActivityPrivacy, keyof typeof Ionicons.glyphMap> = {
  everyone: 'globe-outline',
  followers: 'people-outline',
  only_me: 'lock-closed-outline',
};

const PRIVACY_LABEL: Record<ActivityPrivacy, string> = {
  everyone: 'Everyone',
  followers: 'Followers',
  only_me: 'Only Me',
};

interface Props {
  activity: Activity;
  unitSystem: UnitSystem;
  /** Whether the list is picking rows; the box shows only then. */
  selecting: boolean;
  selected: boolean;
  onPress(): void;
  onLongPress(): void;
}

/** An activity in the full list: sport, title, when, how far, who can see it, and a box while picking. */
export function ActivityPickRow({
  activity,
  unitSystem,
  selecting,
  selected,
  onPress,
  onLongPress,
}: Props) {
  const theme = useTheme();
  const privacy = activity.privacy ?? 'everyone';
  const name = activity.name || 'Activity';
  const when = formatWeekdayDay(activity.stream?.startedAt ?? activity.createdAt);
  return (
    <Tappable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.row,
        {
          backgroundColor: selected ? tint(theme.brand.primary, 0.12) : theme.backgroundElement,
          borderColor: selected ? theme.brand.primary : theme.border,
        },
      ]}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: selected } : undefined}
      accessibilityLabel={`${name}, ${when}, ${formatDistance(activity.distance, unitSystem)}, ${PRIVACY_LABEL[privacy]}`}
    >
      {selecting ? (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={selected ? theme.brand.primary : theme.textSecondary}
        />
      ) : (
        <Ionicons name={SPORT_ICONS[activity.activityType]} size={22} color={theme.textSecondary} />
      )}
      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
          {when} · {formatDistance(activity.distance, unitSystem)} ·{' '}
          {formatDuration(activity.duration)}
        </ThemedText>
      </View>
      <Ionicons name={PRIVACY_ICON[privacy]} size={16} color={theme.textSecondary} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  info: { flex: 1, gap: Spacing.half },
});
