import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import type { Activity } from '@/types';
import { isStatHidden } from '@/utils/activityStats';
import { formatDistance, formatDurationLong, formatPaceOrSpeed } from '@/utils/format';

interface Props {
  activity: Activity;
  isOwner: boolean;
  unitSystem: Parameters<typeof formatDistance>[1];
  onPress: () => void;
}

/** One line of headline numbers shown while the activity sheet is collapsed; tapping opens it. */
export function ActivitySummaryLine({ activity, isOwner, unitSystem, onPress }: Props) {
  return (
    <Tappable
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Show the activity details"
    >
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {[
          formatDistance(activity.distance, unitSystem),
          formatDurationLong(activity.duration),
          isStatHidden('pace', activity.hiddenStats, isOwner)
            ? null
            : formatPaceOrSpeed(
                activity.activityType,
                activity.distance,
                activity.duration,
                unitSystem
              ),
        ]
          .filter(Boolean)
          .join(' · ')}
      </ThemedText>
    </Tappable>
  );
}
