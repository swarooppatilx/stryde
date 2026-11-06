import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityType, Lap } from '@/types';
import { formatDistance, formatDuration, formatPaceOrSpeed, type UnitSystem } from '@/utils/format';
import { ThemedText } from './themed-text';

interface Props {
  laps: readonly Lap[];
  unitSystem: UnitSystem;
  activityType: ActivityType;
}

/** The laps the athlete marked while recording: each one's distance, time and pace (or speed). */
export function LapsList({ laps, unitSystem, activityType }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {laps.map((lap) => (
        <View key={lap.index} style={styles.row}>
          <ThemedText type="small" style={[styles.index, { color: theme.textSecondary }]}>
            {lap.index}
          </ThemedText>
          <ThemedText type="small" style={styles.distance}>
            {formatDistance(lap.distance, unitSystem)}
          </ThemedText>
          <ThemedText type="small" style={styles.time}>
            {formatDuration(lap.duration)}
          </ThemedText>
          <ThemedText type="small" style={styles.pace}>
            {formatPaceOrSpeed(activityType, lap.distance, lap.duration, unitSystem)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  index: { width: 24 },
  distance: { flex: 1 },
  time: { flex: 1, textAlign: 'right' },
  pace: { flex: 1, textAlign: 'right' },
});
