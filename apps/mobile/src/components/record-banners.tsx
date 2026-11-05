import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { BorderRadius, Brand, IconSize, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityType, Lap } from '@/types';
import { formatDuration, formatPaceOrSpeed, type UnitSystem } from '@/utils/format';
import { ThemedText } from './themed-text';

/** A bar across the sheet while the clock is stopped, so a paused run cannot be mistaken for a live one. */
export function PausedBar({ autoPaused }: { autoPaused: boolean }) {
  const label = autoPaused ? 'Auto-paused' : 'Paused';
  return (
    <View
      style={styles.paused}
      accessibilityRole="alert"
      accessibilityLabel={autoPaused ? 'Auto-paused. Recording resumes when you move.' : label}
    >
      <Ionicons name="pause" size={IconSize.badge} color={Brand.warning} />
      <ThemedText type="smallBold" themeColor="warningText">
        {label}
      </ThemedText>
      {autoPaused && (
        <ThemedText type="small" themeColor="warningText">
          Moves on when you do
        </ThemedText>
      )}
    </View>
  );
}

interface LapCompleteCardProps {
  lap: Lap;
  activityType: ActivityType;
  unitSystem: UnitSystem;
}

/** Shown for a few seconds after Lap is pressed: the lap just closed and how fast it was. */
export function LapCompleteCard({ lap, activityType, unitSystem }: LapCompleteCardProps) {
  const theme = useTheme();
  const time = formatDuration(lap.duration);
  const pace = formatPaceOrSpeed(activityType, lap.distance, lap.duration, unitSystem);
  return (
    <View
      style={[styles.lap, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Lap ${lap.index} complete. ${time}. ${pace}`}
    >
      <Ionicons name="flag" size={IconSize.inline} color={Brand.primary} />
      <ThemedText type="smallBold">Lap {lap.index} complete</ThemedText>
      <View style={styles.lapFigures}>
        <ThemedText type="smallBold">{time}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {pace}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  paused: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: tint(Brand.warning, 0.18),
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  lap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  lapFigures: { flexDirection: 'row', gap: Spacing.two, marginLeft: 'auto' },
});
