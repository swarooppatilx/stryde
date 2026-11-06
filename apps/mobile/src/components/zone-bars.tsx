import { StyleSheet, View } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/utils/format';
import type { ZoneTime } from '@/utils/heartRateZones';
import { ThemedText } from './themed-text';

interface Props {
  zones: readonly ZoneTime[];
  /** Says what the zones are measured against. */
  note: string;
}

/** Time spent in each zone, as bars sized by share. */
export function ZoneBars({ zones, note }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {zones.map(({ zone, seconds, share }) => (
        <View
          key={zone.id}
          style={styles.row}
          accessible
          accessibilityLabel={`Zone ${zone.id}, ${zone.label}, ${formatDuration(seconds * 1000)}, ${Math.round(share * 100)} percent`}
        >
          <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
            Z{zone.id} {zone.label}
          </ThemedText>
          <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
            <View
              style={[
                styles.fill,
                { width: `${Math.round(share * 100)}%`, backgroundColor: theme.brand.primary },
              ]}
            />
          </View>
          <ThemedText type="caption" style={styles.time}>
            {formatDuration(seconds * 1000)}
          </ThemedText>
        </View>
      ))}
      <ThemedText type="caption" themeColor="textSecondary">
        {note}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { width: 112 },
  track: { flex: 1, height: 8, borderRadius: BorderRadius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: BorderRadius.full },
  time: { width: 56, textAlign: 'right' },
});
