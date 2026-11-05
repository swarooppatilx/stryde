import { StyleSheet, View } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityType, Split } from '@/types';
import {
  formatDuration,
  formatElevation,
  formatPaceOrSpeed,
  type UnitSystem,
} from '@/utils/format';
import { gradeAdjustedSplits } from '@/utils/gradeAdjusted';
import { ThemedText } from './themed-text';

/** The grade-adjusted column shows only when a hill moves some split's pace by at least this much. */
const GAP_WORTH_SHOWING = 0.03;

interface Props {
  splits: readonly Split[];
  unitSystem: UnitSystem;
  activityType: ActivityType;
}

function elevationSign(elevation: number): string {
  if (elevation > 0) return '+';
  return elevation < 0 ? '−' : '';
}

export function SplitsList({ splits, unitSystem, activityType }: Props) {
  const theme = useTheme();
  const unit = unitSystem === 'imperial' ? 'mi' : 'km';
  const fastest = Math.min(
    ...splits
      .filter((s) => s.distance > 0 && s.movingTime > 0)
      .map((s) => s.movingTime / s.distance)
  );

  const showsElevation = splits.some((s) => s.elevation !== undefined);
  const adjusted = gradeAdjustedSplits(splits, activityType);
  const showsGap = adjusted?.some((a, i) => {
    const raw = splits[i]?.movingTime ?? 0;
    return raw > 0 && Math.abs(a.movingTime - raw) / raw >= GAP_WORTH_SHOWING;
  });

  return (
    <View style={styles.container} accessibilityLabel="Splits">
      <View style={styles.row}>
        <ThemedText type="smallBold">Splits</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Moving time {formatDuration(splits.reduce((sum, s) => sum + s.movingTime, 0))}
        </ThemedText>
      </View>
      {splits.map((split, position) => {
        const msPerMeter = split.distance > 0 ? split.movingTime / split.distance : 0;
        const isFastest = msPerMeter > 0 && msPerMeter === fastest;
        // Bar length is speed relative to the fastest split, so faster reads longer.
        const relativeSpeed = msPerMeter > 0 ? fastest / msPerMeter : 0;
        return (
          <View key={split.index} style={styles.row}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
              {unit} {split.index}
            </ThemedText>
            <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${Math.round(relativeSpeed * 100)}%`,
                    backgroundColor: isFastest ? theme.brand.primary : theme.textSecondary,
                  },
                ]}
              />
            </View>
            {showsElevation ? (
              <ThemedText type="caption" themeColor="textSecondary" style={styles.elevation}>
                {split.elevation === undefined
                  ? ''
                  : `${elevationSign(split.elevation)}${formatElevation(Math.abs(split.elevation), unitSystem)}`}
              </ThemedText>
            ) : null}
            {showsGap && adjusted?.[position] ? (
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                style={styles.gap}
                accessibilityLabel={`Grade-adjusted pace ${formatPaceOrSpeed(activityType, split.distance, adjusted[position]?.movingTime ?? 0, unitSystem)}`}
              >
                {`GAP ${formatPaceOrSpeed(activityType, split.distance, adjusted[position]?.movingTime ?? 0, unitSystem)}`}
              </ThemedText>
            ) : null}
            <ThemedText
              type="small"
              style={[styles.pace, isFastest && { color: theme.accentText, fontWeight: '700' }]}
            >
              {formatPaceOrSpeed(activityType, split.distance, split.movingTime, unitSystem)}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one, paddingVertical: Spacing.two },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: { width: 44 },
  track: { flex: 1, height: 6, borderRadius: BorderRadius.full, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: BorderRadius.full },
  elevation: { width: 48, textAlign: 'right' },
  gap: { width: 84, textAlign: 'right' },
  pace: { width: 72, textAlign: 'right' },
});
