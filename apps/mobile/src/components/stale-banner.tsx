import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { STALE_BANNER_COPY } from '@/constants/copy';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  onRetry(): void;
}

/** Above a list that could not refresh: says what is shown is the saved copy, and offers another go. */
export function StaleBanner({ onRetry }: Props) {
  const theme = useTheme();
  return (
    <ThemedView
      style={[
        styles.banner,
        theme.shadows.raised,
        { backgroundColor: theme.backgroundOverlay, borderColor: theme.border },
      ]}
      accessibilityLabel={STALE_BANNER_COPY.message}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={theme.textSecondary} />
      <ThemedText type="caption" themeColor="textSecondary" style={styles.message}>
        {STALE_BANNER_COPY.message}
      </ThemedText>
      <Tappable
        onPress={onRetry}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={STALE_BANNER_COPY.retry}
      >
        <ThemedText type="smallBold" style={{ color: theme.accentText }}>
          {STALE_BANNER_COPY.retry}
        </ThemedText>
      </Tappable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  message: { flex: 1 },
});
