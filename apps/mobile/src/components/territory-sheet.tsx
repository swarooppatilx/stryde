import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useSocialUser } from '@/hooks/useSocialUser';
import { shortAddress } from '@/utils/address';
import { formatArea, formatRelativeTime, getDisplayName } from '@/utils/format';

export interface SelectedTerritory {
  id: string;
  owner: string;
  areaSqm: number;
  strength: number;
  capturedAt: number;
  lastReinforced: number;
}

interface TerritorySheetProps {
  territory: SelectedTerritory;
  loading?: boolean;
  onClose?: () => void;
}

const SHEET_HEIGHT = 260;

/** Shows the owner, area and strength of a tapped map territory, with a shortcut to the owner's profile. */
export function TerritorySheet({ territory, loading, onClose }: TerritorySheetProps) {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const router = useRouter();
  const ownerUser = useSocialUser(territory.owner);
  const ownerLabel = ownerUser ? getDisplayName(ownerUser) : shortAddress(territory.owner);

  const heightState = useSharedValue(SHEET_HEIGHT);
  const animatedStyle = useAnimatedStyle(() => ({ height: heightState.value }));

  const openProfile = () => {
    onClose?.();
    router.push(`/athletes/${territory.owner}`);
  };

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .onEnd((event) => {
          if (event.translationY > 40 || event.velocityY > 500) {
            runOnJS(onClose ?? (() => {}))();
          }
        }),
    [onClose]
  );

  const isOwn = useCurrentUserId() === territory.owner;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.container,
          theme.shadows.sheet,
          animatedStyle,
          {
            backgroundColor: theme.backgroundElement,
            paddingBottom: Spacing.four,
          },
        ]}
      >
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={theme.brand.primary} />
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={[styles.headerIcon, { backgroundColor: theme.brand.primaryTint }]}>
                <Ionicons name="flag" size={20} color={theme.brand.primary} />
              </View>
              <ThemedView style={styles.headerText}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {ownerLabel}
                  {isOwn ? ' (you)' : ''}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  Territory owner
                </ThemedText>
              </ThemedView>
              {onClose && (
                <Tappable
                  onPress={onClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close territory details"
                >
                  <Ionicons name="close" size={20} color={theme.textSecondary} />
                </Tappable>
              )}
            </View>

            <View style={styles.statsRow}>
              <View style={[styles.statItem, { backgroundColor: theme.background }]}>
                <ThemedText style={[styles.statValue, { color: theme.text }]}>
                  {formatArea(territory.areaSqm, unitSystem)}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  Area
                </ThemedText>
              </View>
              <View style={[styles.statItem, { backgroundColor: theme.background }]}>
                <ThemedText style={[styles.statValue, { color: theme.text }]}>
                  {territory.strength.toLocaleString()}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  Strength
                </ThemedText>
              </View>
              <View style={[styles.statItem, { backgroundColor: theme.background }]}>
                <ThemedText style={[styles.statValue, { color: theme.text }]}>
                  {formatRelativeTime(new Date(territory.capturedAt * 1000), true)}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  Captured
                </ThemedText>
              </View>
            </View>

            <Tappable
              style={[styles.profileBtn, { borderColor: theme.brand.primary }]}
              onPress={openProfile}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`View ${ownerLabel}'s profile`}
            >
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                View profile
              </ThemedText>
            </Tappable>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: BorderRadius.xxs,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  statValue: {
    ...textStyle(TypeScale.calloutBold),
    textAlign: 'center',
  },
  profileBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
});
