import { StyleSheet } from 'react-native';
import { LOW_POWER_COPY } from '@/constants/copy';
import { Spacing } from '@/constants/theme';
import { useBatteryProfile } from '@/hooks/useBatteryProfile';
import { ThemedText } from './themed-text';

/** One line saying the GPS is set gentler than chosen because of the battery; nothing when it is not. */
export function LowPowerStatus() {
  const profile = useBatteryProfile();
  if (!profile.reason) return null;
  const seconds = Math.round(profile.timeIntervalMs / 1000);
  return (
    <ThemedText type="caption" themeColor="textSecondary" style={styles.line}>
      {LOW_POWER_COPY[profile.reason](seconds)}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  line: { textAlign: 'center', paddingHorizontal: Spacing.three },
});
