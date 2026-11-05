import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { OfflineMapStatus } from '@/services/offlineMaps';

const megabytes = (bytes: number) =>
  `${(bytes / 1_048_576).toFixed(bytes < 10_485_760 ? 1 : 0)} MB`;

interface OfflineMapCardProps {
  status: OfflineMapStatus;
  onDownload(): void;
  onRemove(): void;
}

/** Download the map around a route for use with no signal, and see what is already on the phone. */
export function OfflineMapCard({ status, onDownload, onRemove }: OfflineMapCardProps) {
  const theme = useTheme();
  const ready = status.state === 'ready';
  const downloading = status.state === 'downloading';

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.header}>
        <Ionicons
          name={ready ? 'cloud-done-outline' : 'cloud-download-outline'}
          size={22}
          color={ready ? theme.brand.success : theme.text}
        />
        <View style={styles.text}>
          <ThemedText type="smallBold">{ready ? 'Available offline' : 'Offline map'}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" accessibilityLiveRegion="polite">
            {ready && `${megabytes(status.bytes)} on this phone, in the current map type`}
            {downloading && `Downloading… ${status.percent}%`}
            {status.state === 'none' && 'Save the map around this route for places with no signal'}
            {status.state === 'failed' &&
              "The download didn't finish. Check your connection and try again."}
          </ThemedText>
        </View>
      </View>
      {downloading && (
        <View
          style={[styles.track, { backgroundColor: theme.background }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: status.percent }}
        >
          <View
            style={[
              styles.fill,
              { width: `${status.percent}%`, backgroundColor: theme.brand.primary },
            ]}
          />
        </View>
      )}
      {!downloading &&
        (ready ? (
          <AppButton variant="ghost" size="small" onPress={onRemove}>
            Remove offline map
          </AppButton>
        ) : (
          <AppButton variant="secondary" size="small" onPress={onDownload}>
            Download map
          </AppButton>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: BorderRadius.lg, gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  text: { flex: 1, gap: 2 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
