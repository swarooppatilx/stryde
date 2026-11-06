import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LiveWatch } from '@/services/watchRecording';

/** One line under the live stats: the watch's heart rate, or that it dropped out. Nothing without a watch. */
export function WatchStrip({ watch }: { watch: LiveWatch | null }) {
  const theme = useTheme();
  if (!watch) return null;
  const lost = watch.state === 'disconnected';
  const text = (() => {
    if (lost) return 'Watch disconnected: recording with the phone';
    if (watch.state === 'ended') return 'Watch workout ended: recording with the phone';
    if (watch.heartRate === undefined) return 'Apple Watch connected';
    return `${Math.round(watch.heartRate)} bpm`;
  })();
  return (
    <View
      style={[styles.strip, { backgroundColor: theme.backgroundElement }]}
      accessible
      accessibilityLabel={lost ? text : `Apple Watch: ${text}`}
    >
      <Ionicons name="watch-outline" size={14} color={theme.textSecondary} />
      {watch.heartRate !== undefined && !lost && (
        <Ionicons name="heart" size={12} color={Brand.danger} />
      )}
      <ThemedText type="caption" themeColor={lost ? 'warningText' : 'text'}>
        {text}
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
