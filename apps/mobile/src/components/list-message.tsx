import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Tappable } from '@/components/tappable';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { detailFallback } from '@/utils/detailState';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  action?: { label: string; onPress(): void };
  /** Take the whole screen, centred (a screen-level state rather than an empty list). */
  fill?: boolean;
}

/** The empty or error state of a list. */
export function ListMessage({ icon, text, action, fill }: Props) {
  const theme = useTheme();
  return (
    <ThemedView style={[styles.container, fill && styles.fill]}>
      <Ionicons name={icon} size={32} color={theme.textSecondary} />
      <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center' }}>
        {text}
      </ThemedText>
      {action && (
        <Tappable onPress={action.onPress} hitSlop={8} accessibilityRole="button">
          <ThemedText type="smallBold" style={{ color: theme.accentText }}>
            {action.label}
          </ThemedText>
        </Tappable>
      )}
    </ThemedView>
  );
}

/** Full-screen body for a detail page whose item isn't available: loading, failed (with retry) or not found. */
export function DetailFallback({
  what,
  loading,
  error,
  onRetry,
}: {
  what: string;
  loading: boolean;
  error: string | null;
  onRetry(): void;
}) {
  const state = detailFallback({ loading, error });
  if (state === 'loading') return <ListLoading fill />;
  if (state === 'error') {
    return (
      <ListMessage
        fill
        icon="cloud-offline-outline"
        text={`Could not load this ${what}. Check your connection and try again.`}
        action={{ label: 'Try again', onPress: onRetry }}
      />
    );
  }
  return (
    <ListMessage
      fill
      icon="search-outline"
      text={`${what[0]?.toUpperCase()}${what.slice(1)} not found`}
    />
  );
}

export function ListLoading({ fill }: { fill?: boolean } = {}) {
  const theme = useTheme();
  return (
    <ThemedView style={[styles.container, fill && styles.fill]}>
      <ActivityIndicator size="small" color={theme.brand.primary} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  fill: { flex: 1 },
});
