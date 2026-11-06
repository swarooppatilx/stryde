import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { BestEffort } from '@/types';
import { effortLabel } from '@/utils/effortLabel';
import { formatDuration, formatPace, type UnitSystem } from '@/utils/format';
import { ThemedText } from './themed-text';

interface Props {
  efforts: readonly BestEffort[];
  unitSystem: UnitSystem;
}

/** The fastest 1 km / 5 km / 10 km inside one run, with the pace each implies. */
export function BestEfforts({ efforts, unitSystem }: Props) {
  return (
    <View style={styles.container}>
      {efforts.map((effort) => (
        <View key={effort.distance} style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            {effortLabel(effort.distance)}
          </ThemedText>
          <ThemedText type="small">
            {formatDuration(effort.movingTime)} ·{' '}
            {formatPace(effort.distance, effort.movingTime, unitSystem)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
