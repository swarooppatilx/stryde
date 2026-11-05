import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { ChainSyncRetry } from '@/components/chain-sync-retry';
import { IconBadge } from '@/components/icon-badge';
import { RewardHoldBanner } from '@/components/reward-hold-banner';
import { OffscreenShareImage } from '@/components/share-route-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSportIcon } from '@/constants/activity';
import { SAVE_TIMING_COPY } from '@/constants/copy';
import { BorderRadius, IconSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useActivity } from '@/hooks/useActivity';
import { useChainRetry } from '@/hooks/useChainRetry';
import { usePhotoPick } from '@/hooks/usePhotoPick';
import { useTimeToIndexed } from '@/hooks/useTimeToIndexed';
import { useActivityStore } from '@/stores/activityStore';
import { activityStats } from '@/utils/activityStats';
import { celebrationFor, isShortActivity } from '@/utils/celebration';
import { nextStepsAfterSave } from '@/utils/nextSteps';
import { formatSeconds } from '@/utils/timeToIndexed';

const NO_PHOTOS: string[] = [];

/** Shown right after a save: the activity in one glance, then on to it or back home. */
function timingLine(timing: { indexedMs?: number; confirmedMs?: number }): string {
  if (timing.indexedMs !== undefined)
    return SAVE_TIMING_COPY.indexed(formatSeconds(timing.indexedMs));
  if (timing.confirmedMs !== undefined)
    return SAVE_TIMING_COPY.saved(formatSeconds(timing.confirmedMs));
  return ' ';
}

export default function PostUploadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  // The same share image and photo save as the activity page, so photos follow its publish rules.
  const { activity, coordinates, territory, svgRef, handleShare, savePhotos, isOwner } =
    useActivity();
  const chainRetry = useChainRetry(id);
  const timing = useTimeToIndexed(id);
  const activityCount = useActivityStore((s) => s.activities.length);
  const addPhoto = usePhotoPick(activity?.images ?? NO_PHOTOS, savePhotos);

  const goHome = () => router.replace('/');
  const viewActivity = () => router.replace({ pathname: '/activities/[id]', params: { id } });

  // Going back would land on the save form that was just submitted.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/');
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  if (!activity) return <Redirect href="/" />;

  const stats = activityStats(activity, unitSystem);
  const nextSteps = nextStepsAfterSave(activity, isOwner);

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <IconBadge size="lg" backgroundColor={theme.brand.primaryTint}>
            <Ionicons
              name={getSportIcon(activity.activityType)}
              size={32}
              color={theme.brand.primary}
            />
          </IconBadge>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            Activity saved
          </ThemedText>
          <ThemedText type="display" style={styles.title}>
            {activity.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.celebration}>
            {celebrationFor({ activityCount, short: isShortActivity(activity) })}
          </ThemedText>
          {chainRetry.canRetry && (
            <ChainSyncRetry busy={chainRetry.busy} onRetry={chainRetry.retry} />
          )}
          <RewardHoldBanner activity={activity} />

          {stats.length > 0 && (
            <View style={[styles.stats, { backgroundColor: theme.backgroundElement }]}>
              {stats.map((stat) => (
                <View key={stat.label} style={styles.stat}>
                  <ThemedText type="headline">{stat.value}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {stat.label}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* The line is always reserved, so it appearing never moves the screen. */}
          <ThemedText
            type="caption"
            themeColor="textSecondary"
            style={styles.timing}
            accessibilityLiveRegion="polite"
          >
            {timingLine(timing)}
          </ThemedText>

          {nextSteps.length > 0 && (
            <View style={styles.nextSteps}>
              {nextSteps.map((step) =>
                step === 'share' ? (
                  <AppButton
                    key={step}
                    variant="ghost"
                    size="small"
                    fullWidth={false}
                    onPress={handleShare}
                    accessibilityLabel="Share this activity"
                    icon={
                      <Ionicons
                        name="share-outline"
                        size={IconSize.inline}
                        color={theme.brand.primary}
                      />
                    }
                  >
                    Share
                  </AppButton>
                ) : (
                  <AppButton
                    key={step}
                    variant="ghost"
                    size="small"
                    fullWidth={false}
                    onPress={addPhoto}
                    accessibilityLabel="Add a photo to this activity"
                    icon={
                      <Ionicons
                        name="camera-outline"
                        size={IconSize.inline}
                        color={theme.brand.primary}
                      />
                    }
                  >
                    Add a photo
                  </AppButton>
                )
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <AppButton onPress={viewActivity}>View activity</AppButton>
          <AppButton variant="secondary" onPress={goHome}>
            Done
          </AppButton>
        </View>
      </SafeAreaView>

      {/* Drawn off-screen so Share has an image to capture, as on the activity page. */}
      <OffscreenShareImage
        ref={svgRef}
        coordinates={coordinates}
        territory={territory}
        territoryArea={activity.territoryArea}
        distance={activity.distance}
        duration={activity.duration}
        activityType={activity.activityType}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  celebration: { textAlign: 'center' },
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  title: { textAlign: 'center' },
  timing: { textAlign: 'center', minHeight: 18 },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.three,
  },
  stat: { alignItems: 'center', gap: Spacing.half, minWidth: 96 },
  nextSteps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.two },
  actions: { gap: Spacing.two, paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
});
