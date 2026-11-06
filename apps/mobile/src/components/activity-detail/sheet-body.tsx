import { getActiveConfig } from '@repo/shared';
import { ScrollView, StyleSheet } from 'react-native';
import { ActivityActionRow } from '@/components/activity-action-row';
import { ActivityChartPager } from '@/components/activity-chart-pager';
import { ActivityDescription } from '@/components/activity-description';
import { AnalysisCard } from '@/components/activity-detail/analysis-card';
import { ResultsCard } from '@/components/activity-detail/results-card';
import { ActivityHeartRateSection } from '@/components/activity-heart-rate-section';
import { ActivityPaceZonesSection } from '@/components/activity-pace-zones-section';
import { ActivityPhotos } from '@/components/activity-photos';
import { ActivityPrivateDetails } from '@/components/activity-private-details';
import { ActivityProofCard } from '@/components/activity-proof-card';
import { ActivityReceiptLink } from '@/components/activity-receipt-link';
import { ActivityRecordChips } from '@/components/activity-record-chips';
import { ActivitySocialRow } from '@/components/activity-social-row';
import { BestEfforts } from '@/components/best-efforts';
import { AppButton } from '@/components/button';
import { GearPicker } from '@/components/gear-picker';
import { LapsList } from '@/components/laps-list';
import { RewardHoldBanner } from '@/components/reward-hold-banner';
import { SplitsList } from '@/components/splits-list';
import { StatRow } from '@/components/stat-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getChainMode } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import type { useActivity } from '@/hooks/useActivity';
import { useActivityInsights } from '@/hooks/useActivityInsights';
import { useSavedRouteToggle } from '@/hooks/useSavedRouteToggle';
import { useGearStore } from '@/stores/gearStore';
import { useProfileStore } from '@/stores/profileStore';
import type { Activity } from '@/types';
import { activityHeadlineStats } from '@/utils/activityHeadline';
import type { ActivityResults } from '@/utils/activityResults';
import { explorerTxUrl } from '@/utils/chainProof';
import { elevationWorthShowing } from '@/utils/elevationWorthShowing';
import { formatArea, formatDuration } from '@/utils/format';
import { gearForSport } from '@/utils/gearMileage';
import { similarRunsText } from '@/utils/similarRuns';

type Detail = ReturnType<typeof useActivity>;

interface Props {
  activity: Activity;
  detail: Pick<
    Detail,
    | 'coordinates'
    | 'elevationData'
    | 'isOwner'
    | 'savePhotos'
    | 'setGear'
    | 'descriptionDraft'
    | 'setDescriptionDraft'
    | 'handleStartEditDescription'
    | 'handleSaveDescription'
    | 'handleCancelEditDescription'
    | 'handleCopy'
    | 'handleDownload'
    | 'handleExport'
    | 'handleDelete'
    | 'goHome'
  >;
  results: ActivityResults;
  onOpenComments(): void;
  onShare(): void;
  onFlyover(): void;
  onScrubChange(streamIndex: number | null): void;
  onContentHeight(height: number): void;
}

/** The sheet's scrolling body: the figures, photos, social strip, analysis cards, then the owner's fields and actions. */
export function ActivitySheetBody({
  activity,
  detail,
  results,
  onOpenComments,
  onShare,
  onFlyover,
  onScrubChange,
  onContentHeight,
}: Props) {
  const unitSystem = useUnitSystem();
  const allGear = useGearStore((s) => s.gear);
  const ownWeightKg = useProfileStore((s) => s.settings.weightKg);
  const { isOwner, coordinates, elevationData } = detail;
  const { routeSaved, toggleSavedRoute } = useSavedRouteToggle(activity);
  const {
    bestEfforts,
    zoneTimes,
    paceZones,
    threshold,
    similar,
    heldRecords,
    maxHr,
    restingHr,
    hasHeartRate,
  } = useActivityInsights(activity, isOwner);

  const stats = activityHeadlineStats(activity, {
    elevationData,
    isOwner,
    ownWeightKg,
    unitSystem,
  });
  if (activity.territory) {
    stats.push({ label: 'Territory', value: formatArea(activity.territoryArea, unitSystem) });
  }
  const chartElevations =
    elevationData && elevationWorthShowing(elevationData) ? elevationData.elevations : undefined;
  // The receipt is the block explorer's copy of the proof; the hash lives there, not on this screen.
  const receipt =
    getChainMode() === 'local'
      ? null
      : explorerTxUrl(getActiveConfig().chain.blockExplorers?.default.url, activity.txHash);
  const gearOptions = gearForSport(allGear, activity.activityType);
  const splits = activity.splits && activity.splits.length > 1 ? activity.splits : null;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      onContentSizeChange={(_, h) => onContentHeight(h)}
    >
      <StatRow stats={stats} columns={2} />

      <ActivityPhotos
        photos={activity.images}
        isOwner={isOwner}
        onPhotosChange={detail.savePhotos}
      />

      {receipt && <ActivityReceiptLink url={receipt} />}

      <ActivitySocialRow activityId={activity.id} onOpen={onOpenComments} onShare={onShare} />

      <ActivityRecordChips records={heldRecords} />

      {similar ? (
        <ThemedText type="small" themeColor="textSecondary">
          {similarRunsText(similar)}
        </ThemedText>
      ) : null}

      <ResultsCard results={results} />

      {bestEfforts.length > 0 && (
        <AnalysisCard title="Best efforts">
          <BestEfforts efforts={bestEfforts} unitSystem={unitSystem} />
        </AnalysisCard>
      )}

      {activity.laps && activity.laps.length > 0 && (
        <AnalysisCard title="Laps">
          <LapsList
            laps={activity.laps}
            unitSystem={unitSystem}
            activityType={activity.activityType}
          />
        </AnalysisCard>
      )}

      <ActivityChartPager
        stream={activity.stream}
        elevations={chartElevations}
        activityType={activity.activityType}
        unitSystem={unitSystem}
        onScrubChange={onScrubChange}
      />

      <ActivityHeartRateSection
        zones={zoneTimes}
        maxHr={maxHr}
        restingHr={restingHr}
        hasHeartRate={hasHeartRate}
        isOwner={isOwner}
      />

      {threshold && (
        <ActivityPaceZonesSection zones={paceZones} threshold={threshold} unitSystem={unitSystem} />
      )}

      {splits && (
        <AnalysisCard
          title="Splits"
          aside={`Moving time ${formatDuration(splits.reduce((sum, s) => sum + s.movingTime, 0))}`}
        >
          <SplitsList
            splits={splits}
            unitSystem={unitSystem}
            activityType={activity.activityType}
          />
        </AnalysisCard>
      )}

      {isOwner && gearOptions.length > 0 && (
        <ThemedView style={styles.gear}>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            {activity.activityType === 'ride' ? 'Bike' : 'Shoes'}
          </ThemedText>
          <GearPicker
            options={gearOptions}
            selected={activity.gearId ?? null}
            onSelect={detail.setGear}
          />
        </ThemedView>
      )}

      <ActivityDescription
        editable={isOwner}
        description={activity.description}
        draft={detail.descriptionDraft}
        onChangeDraft={detail.setDescriptionDraft}
        onStartEdit={detail.handleStartEditDescription}
        onCancel={detail.handleCancelEditDescription}
        onSave={detail.handleSaveDescription}
      />

      {isOwner && <RewardHoldBanner activity={activity} />}
      {isOwner && <ActivityProofCard activity={activity} />}
      {isOwner && <ActivityPrivateDetails activity={activity} />}

      <ThemedView style={styles.actions}>
        <AppButton onPress={detail.goHome} style={styles.doneButton}>
          Done
        </AppButton>

        <ActivityActionRow
          hasRoute={coordinates.length > 1}
          routeSaved={routeSaved}
          isOwner={isOwner}
          onCopy={detail.handleCopy}
          onFlyover={onFlyover}
          onDownload={detail.handleDownload}
          onExport={detail.handleExport}
          onToggleSavedRoute={toggleSavedRoute}
          onDelete={detail.handleDelete}
        />
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  gear: { marginTop: Spacing.two },
  actions: { gap: Spacing.three },
  doneButton: { alignSelf: 'stretch', borderRadius: BorderRadius.full },
});
