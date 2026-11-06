import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { ActivityRow } from '@/components/activity-row';
import { IconSize, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Activity, ActivityPrivacy } from '@/types';
import { activitySubline } from '@/utils/activitySubline';
import type { UnitSystem } from '@/utils/format';

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

/** An activity in the full list: its map, title, one meta line, who can see it, and a box while picking. */
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
  return (
    <ActivityRow
      variant="compact"
      title={activity.name || 'Activity'}
      meta={activitySubline(activity, unitSystem)}
      sport={activity.activityType}
      polyline={activity.polyline}
      onPress={onPress}
      onLongPress={onLongPress}
      style={
        selected
          ? {
              backgroundColor: tint(theme.brand.primary, 0.12),
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.brand.primary,
            }
          : undefined
      }
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: selected } : undefined}
      accessibilitySuffix={PRIVACY_LABEL[privacy]}
      trailing={
        <View style={styles.trailing}>
          <Ionicons
            name={PRIVACY_ICON[privacy]}
            size={IconSize.badge}
            color={theme.textSecondary}
          />
          {selecting ? (
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={IconSize.action}
              color={selected ? theme.brand.primary : theme.textSecondary}
            />
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  trailing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
