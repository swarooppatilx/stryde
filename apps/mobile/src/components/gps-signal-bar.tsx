import { StyleSheet, View } from 'react-native';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type GpsSignal, gpsBars } from '@/utils/gpsSignal';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

const BAR_WIDTH = 4;
const BAR_BASE_HEIGHT = 6;
const BAR_STEP = 4;

/** A four-bar signal meter with its plain-words label, so a weak fix is seen before Start is pressed. */
export function GpsSignalBar({
  signal,
  onOpenLocationSettings,
}: {
  signal: GpsSignal;
  /** Offered when location services are off: the one thing that will fix it. */
  onOpenLocationSettings?: () => void;
}) {
  const theme = useTheme();
  const { total, lit, tone } = gpsBars(signal.level);
  const toneColor = {
    success: Brand.success,
    warning: Brand.warning,
    danger: Brand.danger,
    muted: theme.disabled,
  }[tone];
  const heights = Array.from({ length: total }, (_, i) => BAR_BASE_HEIGHT + i * BAR_STEP);

  const body = (
    <View
      accessible
      accessibilityLabel={signal.hint ? `${signal.label} ${signal.hint}` : signal.label}
      style={styles.column}
    >
      <View style={styles.row}>
        <View style={styles.bars}>
          {heights.map((height, i) => (
            <View
              key={height}
              style={[
                styles.bar,
                { height, backgroundColor: i < lit ? toneColor : theme.borderBold },
              ]}
            />
          ))}
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {signal.label}
        </ThemedText>
      </View>
      {signal.hint ? (
        <ThemedText type="caption" themeColor="textTertiary" style={styles.hint}>
          {signal.hint}
        </ThemedText>
      ) : null}
    </View>
  );

  if (signal.level !== 'off' || !onOpenLocationSettings) return body;
  return (
    <Tappable
      onPress={onOpenLocationSettings}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${signal.label}. Open phone settings to turn it on`}
    >
      {body}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: Spacing.one },
  hint: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.half },
  bar: { width: BAR_WIDTH, borderRadius: BorderRadius.xxs },
});
