import { SwipeAction } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityRow } from '@/components/activity-row';
import { Brand, IconSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Activity } from '@/types';
import { activitySubline } from '@/utils/activitySubline';
import type { UnitSystem } from '@/utils/format';

interface Props {
  activity: Activity;
  unitSystem: UnitSystem;
  onPress(): void;
  /** Swipe-to-delete; the caller confirms with the user. */
  onDelete(): void;
}

export function ProfileActivityRow({ activity, unitSystem, onPress, onDelete }: Props) {
  const theme = useTheme();

  return (
    <SwipeAction
      right={[
        {
          text: 'Delete',
          color: Brand.white,
          backgroundColor: theme.brand.danger,
          onPress: onDelete,
        },
      ]}
    >
      <ActivityRow
        variant="compact"
        title={activity.name || 'Activity'}
        meta={activitySubline(activity, unitSystem)}
        sport={activity.activityType}
        polyline={activity.polyline}
        onPress={onPress}
        trailing={
          <Ionicons name="chevron-forward" size={IconSize.badge} color={theme.textSecondary} />
        }
      />
    </SwipeAction>
  );
}
