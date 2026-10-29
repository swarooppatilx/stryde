import { Ionicons } from '@expo/vector-icons';
import { getActiveConfig } from '@repo/shared';
import { useLocalSearchParams } from 'expo-router';

import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getChainMode } from '@/constants/config';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBadgeMinted } from '@/hooks/useBadgeMinted';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useGoBack } from '@/hooks/useGoBack';
import { useTerritorySummary } from '@/hooks/useTerritorySummary';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useActivityStore } from '@/stores/activityStore';
import type { Activity } from '@/types';
import { achievementsEarnedBy, computeAchievements } from '@/utils/achievements';
import { BADGE_COPY, badgeShareMessage, badgeState } from '@/utils/badgeState';
import { explorerAddressUrl } from '@/utils/chainProof';
import { formatMonthYear } from '@/utils/dates';
import { shareText } from '@/utils/share';
import { Toast } from '@/utils/toast';

const ART_SIZE = 120;
const ART_ICON_SIZE = 56;

function badgeEarnedAt(activities: readonly Activity[], badgeId: string | undefined): Date | null {
  for (const [activityId, earned] of achievementsEarnedBy(activities)) {
    if (earned.some((a) => a.id === badgeId)) {
      return activities.find((a) => a.id === activityId)?.createdAt ?? null;
    }
  }
  return null;
}

/** One badge: what it is, what earns it, and whether it is saved to the chain. Opened from a badge or the line after a run. */
export default function BadgeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useGoBack();
  const theme = useTheme();
  const activities = useActivityStore((s) => s.activities);
  const currentUserId = useCurrentUserId();
  const { totalArea } = useTerritorySummary(currentUserId);
  const { address } = useViemWallet();

  const badge = computeAchievements(activities, totalArea).find((a) => a.id === id);
  // The activity that tipped it over, so the page can say when it was earned.
  const earnedAt = badgeEarnedAt(activities, id);

  const unlocked = badge?.unlocked ?? false;
  const { read, retry } = useBadgeMinted(id ?? '', address, unlocked);
  const state = badgeState({ unlocked, read });
  const copy = BADGE_COPY[state];

  const proofUrl =
    state === 'minted' && getChainMode() !== 'local'
      ? explorerAddressUrl(getActiveConfig().chain.blockExplorers?.default.url, address)
      : null;

  const accent = unlocked && badge ? badge.color : theme.textSecondary;

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Tappable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle" accessibilityRole="header">
            Badge
          </ThemedText>
          <View style={styles.spacer} />
        </View>

        {badge ? (
          <ScrollView contentContainerStyle={styles.content}>
            <View
              style={[styles.art, { backgroundColor: tint(accent, 0.2) }]}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`${badge.title} badge${unlocked ? '' : ', not earned yet'}`}
            >
              <Ionicons
                name={(unlocked ? badge.icon : 'lock-closed') as keyof typeof Ionicons.glyphMap}
                size={ART_ICON_SIZE}
                color={accent}
              />
            </View>

            <View style={styles.titles}>
              <ThemedText type="title" accessibilityRole="header" style={styles.centered}>
                {badge.title}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.centered}>
                {badge.description}
              </ThemedText>
            </View>

            <ThemedView style={[styles.status, { backgroundColor: theme.backgroundSunken }]}>
              {state === 'checking' ? (
                <ActivityIndicator accessibilityLabel="Checking this badge" />
              ) : (
                <>
                  <ThemedText type="smallBold">{copy.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {copy.body}
                  </ThemedText>
                </>
              )}
              {state === 'unavailable' && (
                <Tappable onPress={retry} accessibilityRole="button" accessibilityLabel="Try again">
                  <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                    Try again
                  </ThemedText>
                </Tappable>
              )}
              {unlocked && earnedAt && (
                <ThemedText type="caption" themeColor="textSecondary">
                  {`Earned ${formatMonthYear(earnedAt)}`}
                </ThemedText>
              )}
            </ThemedView>

            {proofUrl && (
              <AppButton
                variant="secondary"
                accessibilityLabel="View proof of this badge"
                onPress={() =>
                  Linking.openURL(proofUrl).catch(() => Toast.fail('Could not open the proof', 1))
                }
              >
                View proof
              </AppButton>
            )}
            {unlocked && (
              <AppButton
                accessibilityLabel={`Share the ${badge.title} badge`}
                onPress={() => void shareText(badgeShareMessage(badge.title))}
              >
                Share
              </AppButton>
            )}
          </ScrollView>
        ) : (
          <View style={styles.missing}>
            <ThemedText themeColor="textSecondary">This badge could not be found.</ThemedText>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  spacer: { width: 24 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', gap: Spacing.four, padding: Spacing.four },
  art: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { alignItems: 'center', gap: Spacing.one },
  centered: { textAlign: 'center' },
  status: {
    alignSelf: 'stretch',
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
});
