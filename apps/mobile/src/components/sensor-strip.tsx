import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { SENSORS_COPY } from '@/constants/copy';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SensorKind } from '@/platform/ports';
import { type LiveSensors, newlyLost } from '@/utils/sensorLive';
import { Toast } from '@/utils/toast';

/** Says once, with a notice, when a sensor drops out mid-recording; a line under the stats keeps saying so until it is back. */
export function SensorStrip({ sensors }: { sensors: LiveSensors | null }) {
  const theme = useTheme();
  const told = useRef<readonly SensorKind[]>([]);
  const lost = sensors?.lost ?? [];

  useEffect(() => {
    for (const kind of newlyLost(told.current, lost)) Toast.info(SENSORS_COPY.lostNotice[kind], 3);
    told.current = lost;
  }, [lost]);

  if (lost.length === 0) return null;
  return (
    <View
      style={[styles.strip, { backgroundColor: theme.backgroundElement }]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={SENSORS_COPY.strip.lost}
    >
      <Ionicons name="bluetooth-outline" size={14} color={theme.textSecondary} />
      <ThemedText type="caption" themeColor="warningText">
        {SENSORS_COPY.strip.lost}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
