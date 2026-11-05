import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import type { FollowRouteView } from '@/hooks/useFollowRoute';
import { formatDistance } from '@/utils/format';

interface FollowRouteBannerProps {
  view: FollowRouteView;
  onStop(): void;
  style?: ViewStyle;
}

/** The route being followed: how much is left, and a clear warning when you have left it. */
export function FollowRouteBanner({ view, onStop, style }: FollowRouteBannerProps) {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const { progress, offRoute } = view;
  const tone = offRoute ? theme.brand.danger : theme.backgroundElement;
  const textColor = offRoute ? Palette.white : theme.text;

  const detail = (() => {
    if (!progress) return 'Waiting for GPS…';
    if (offRoute) return `${formatDistance(progress.offsetM, unitSystem)} from the route`;
    if (progress.alongM < 30 && progress.offsetM > 60) {
      return `${formatDistance(progress.offsetM, unitSystem)} to the start`;
    }
    return `${formatDistance(progress.remainingM, unitSystem)} to go of ${formatDistance(progress.totalM, unitSystem)}`;
  })();

  return (
    <View
      style={[styles.banner, theme.shadows.raised, { backgroundColor: tone }, style]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons
        name={offRoute ? 'warning' : 'navigate'}
        size={20}
        color={offRoute ? Palette.white : theme.brand.primary}
      />
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={1} style={{ color: textColor }}>
          {offRoute ? 'Off route' : view.name}
        </ThemedText>
        <ThemedText
          type="caption"
          numberOfLines={1}
          style={{ color: offRoute ? Palette.white : theme.textSecondary }}
        >
          {detail}
        </ThemedText>
      </View>
      <Tappable
        onPress={onStop}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Stop following ${view.name}`}
      >
        <Ionicons name="close" size={20} color={textColor} />
      </Tappable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.lg,
  },
  text: { flex: 1 },
});
