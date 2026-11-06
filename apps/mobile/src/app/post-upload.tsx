import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { ChainSyncRetry } from '@/components/chain-sync-retry';
import { PostSaveHero } from '@/components/post-save-hero';
import { OffscreenShareImage } from '@/components/share-route-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SAVE_TIMING_COPY } from '@/constants/copy';
import { Palette } from '@/constants/palette';
import { IconSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useActivity } from '@/hooks/useActivity';
import { useActivityInsights } from '@/hooks/useActivityInsights';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useChainRetry } from '@/hooks/useChainRetry';
import { usePhotoPick } from '@/hooks/usePhotoPick';
import { useTimeToIndexed } from '@/hooks/useTimeToIndexed';
import { useActivityStore } from '@/stores/activityStore';
import { activityStats } from '@/utils/activityStats';
import { celebrationFor, isShortActivity } from '@/utils/celebration';
import { haptics } from '@/utils/haptics';
import { nextStepsAfterSave, postSaveActions } from '@/utils/nextSteps';
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
  const { heldRecords } = useActivityInsights(activity, isOwner);
  const chainRetry = useChainRetry(id);
  const timing = useTimeToIndexed(id);
  const activityCount = useActivityStore((s) => s.activities.length);
  const addPhoto = usePhotoPick(activity?.images ?? NO_PHOTOS, savePhotos);

  useEffect(() => {
    haptics.success();
  }, []);

  const goHome = () => router.replace('/');
  const viewActivity = () => router.replace({ pathname: '/activities/[id]', params: { id } });

  // Going back would land on the save form that was just submitted.
  useBackHandler(() => router.replace('/'));

  if (!activity) return <Redirect href="/" />;

  const actions = postSaveActions(nextStepsAfterSave(activity, isOwner));

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <PostSaveHero
            name={activity.name ?? ''}
            activityType={activity.activityType}
            polyline={activity.polyline ?? ''}
            celebration={celebrationFor({ activityCount, short: isShortActivity(activity) })}
            stats={activityStats(activity, unitSystem)}
            records={heldRecords}
          />
          {chainRetry.canRetry && (
            <ChainSyncRetry busy={chainRetry.busy} onRetry={chainRetry.retry} />
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
        </ScrollView>

        <View style={styles.actions}>
          <View style={styles.row}>
            {actions.shareIsPrimary && (
              <AppButton
                fullWidth={false}
                style={styles.half}
                onPress={handleShare}
                accessibilityLabel="Share this activity"
                icon={
                  <Ionicons name="share-outline" size={IconSize.inline} color={Palette.white} />
                }
              >
                Share
              </AppButton>
            )}
            <AppButton
              variant={actions.shareIsPrimary ? 'secondary' : 'primary'}
              fullWidth={!actions.shareIsPrimary}
              style={actions.shareIsPrimary ? styles.half : undefined}
              onPress={viewActivity}
            >
              View activity
            </AppButton>
          </View>
          <View style={styles.row}>
            {actions.addPhoto && (
              <AppButton
                variant="secondary"
                fullWidth={false}
                style={styles.half}
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
            )}
            <AppButton
              variant="secondary"
              fullWidth={!actions.addPhoto}
              style={actions.addPhoto ? styles.half : undefined}
              onPress={goHome}
            >
              Done
            </AppButton>
          </View>
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
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  timing: { textAlign: 'center', minHeight: 18 },
  actions: { gap: Spacing.two, paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.two },
  half: { flex: 1 },
});
