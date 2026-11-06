import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useViemWallet } from '@/hooks/useViemWallet';
import { hasSessionForActivity, runPostActivityPipeline } from '@/services/activityPipeline';
import { ARKIV_EXPLORER, routeArchiveGpx } from '@/services/arkivService';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Activity } from '@/types';
import { formatDurationLong } from '@/utils/format';
import { shareGpx } from '@/utils/share';
import { Toast } from '@/utils/toast';

/** Wearable "Proof of Sweat", Arkiv segment efforts and the Swarm archive for one activity. */
export function ActivityProofCard({ activity }: { activity: Activity }) {
  const theme = useTheme();
  const router = useRouter();
  const healthData = useSettingsStore((s) => s.healthData);
  const [syncing, setSyncing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { wallet, address: athlete } = useViemWallet();
  const isPrivate = Boolean(activity.swarmRef && !activity.swarmLink);
  const canResync = healthData && hasSessionForActivity(activity.id);
  const hasContent =
    activity.sweat || activity.segmentEfforts?.length || activity.swarmRef || canResync;
  if (!hasContent) return null;

  const resync = async () => {
    if (!athlete) return;
    setSyncing(true);
    const result = await runPostActivityPipeline({
      activityId: activity.id,
      onchainActivityId: activity.onchainActivityId,
      name: activity.name ?? 'Stryde activity',
      distance: activity.distance,
      athlete,
      scoreOnly: true,
    });
    setSyncing(false);
    if (!result) Toast.fail('Could not reach the Stryde API', 2);
    else if (result.sweat.sampleCount === 0)
      Toast.info('No heart-rate data from your watch yet', 2);
  };

  const download = async () => {
    const archiveKey = activity.swarmArchiveKey;
    if (!archiveKey) return;
    if (isPrivate && !(wallet && athlete)) {
      Toast.info('Connect your wallet to open a private route', 2);
      return;
    }
    setDownloading(true);
    try {
      const auth = isPrivate && wallet && athlete ? { wallet, address: athlete } : null;
      const { gpx } = await routeArchiveGpx(archiveKey, auth);
      await shareGpx(activity.name || activity.id, gpx);
    } catch (error) {
      console.warn('[proof] Swarm download failed:', error);
      Toast.fail('Could not fetch the route from Swarm', 2);
    } finally {
      setDownloading(false);
    }
  };

  const noSweatNote = canResync ? (
    <ThemedText type="caption" themeColor="textSecondary">
      No heart-rate data yet. Watches sync to Health Connect / Apple Health in batches.
    </ThemedText>
  ) : null;

  return (
    <ThemedView style={[styles.card, { backgroundColor: theme.backgroundSelected }]}>
      {activity.sweat ? (
        <ThemedView style={styles.row}>
          <Ionicons
            name={activity.sweat.verified ? 'heart' : 'heart-outline'}
            size={18}
            color={activity.sweat.verified ? Brand.danger : theme.textSecondary}
          />
          <ThemedView style={styles.copy}>
            <ThemedText type="smallBold">
              Proof of Sweat {activity.sweat.score}/100{' '}
              {activity.sweat.verified ? '· verified' : ''}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Avg {activity.sweat.avgBpm} bpm · max {activity.sweat.maxBpm} bpm ·{' '}
              {activity.sweat.sampleCount} samples
              {activity.steps ? ` · ${activity.steps.toLocaleString()} steps` : ''}
            </ThemedText>
          </ThemedView>
        </ThemedView>
      ) : (
        noSweatNote
      )}

      {canResync && (
        <TouchableOpacity onPress={resync} disabled={syncing} accessibilityRole="button">
          <ThemedText type="small" style={{ color: theme.brand.primary }}>
            {syncing ? 'Checking your watch…' : 'Re-check wearable data'}
          </ThemedText>
        </TouchableOpacity>
      )}

      {activity.segmentEfforts?.map((effort) => (
        <TouchableOpacity
          key={effort.key}
          style={styles.row}
          onPress={() =>
            router.push({ pathname: '/segment-detail', params: { key: effort.segmentKey } })
          }
          accessibilityRole="button"
        >
          <Ionicons name="flag-outline" size={18} color={theme.brand.primary} />
          <ThemedView style={styles.copy}>
            <ThemedText type="smallBold">{effort.segmentName}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {formatDurationLong(effort.elapsedSec * 1000)} · recorded on Arkiv
            </ThemedText>
          </ThemedView>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      ))}

      {activity.swarmRef && (
        <ThemedView style={styles.copy}>
          <ThemedView style={styles.row}>
            <Ionicons name="archive-outline" size={18} color={theme.textSecondary} />
            <ThemedText type="caption" themeColor="textSecondary" style={styles.copy}>
              {isPrivate
                ? 'Private GPX archived on Swarm (encrypted, only you can open it)'
                : 'GPX archived on Swarm'}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.actions}>
            {activity.swarmLink && (
              <ArchiveAction
                label="Open on Swarm"
                onPress={() => void Linking.openURL(activity.swarmLink as string)}
              />
            )}
            {activity.swarmArchiveKey && (
              <ArchiveAction
                label="View on Arkiv"
                onPress={() =>
                  void Linking.openURL(`${ARKIV_EXPLORER}/entity/${activity.swarmArchiveKey}`)
                }
              />
            )}
            {activity.swarmArchiveKey && (
              <ArchiveAction
                label={downloading ? 'Downloading…' : 'Download GPX'}
                onPress={() => void download()}
                disabled={downloading}
              />
            )}
          </ThemedView>
        </ThemedView>
      )}
    </ThemedView>
  );
}

function ArchiveAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.action, { borderColor: theme.brand.primary }]}
    >
      <ThemedText type="caption" style={{ color: theme.brand.primary }}>
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  action: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  copy: {
    flex: 1,
    gap: Spacing.half,
    backgroundColor: 'transparent',
  },
});
