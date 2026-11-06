import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/button';
import { Card } from '@/components/card';
import { ChipRow } from '@/components/filter-chips';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SPORT_TYPES } from '@/constants/activity';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useViemWallet } from '@/hooks/useViemWallet';
import { createSegment, nearbySegments, type Segment } from '@/services/arkivService';
import { isNotConfigured } from '@/services/strydeApi';
import { useActivityStore } from '@/stores/activityStore';
import { starredList, useSegmentStarsStore } from '@/stores/segmentStarsStore';
import type { Activity } from '@/types';
import { Alert } from '@/utils/alert';
import { formatDistance } from '@/utils/format';
import { friendlyError } from '@/utils/friendlyError';
import { haversineDistance } from '@/utils/geo';
import { Toast } from '@/utils/toast';

const FILTERS = [
  { value: 'nearby', label: 'Nearby' },
  { value: 'starred', label: 'Starred' },
] as const;

function trackOf(activity: Activity): Array<{ latitude: number; longitude: number }> {
  return activity.polyline.split(';').flatMap((p) => {
    const [lng, lat] = p.split(',').map(Number);
    return lng !== undefined && lat !== undefined && Number.isFinite(lng) && Number.isFinite(lat)
      ? [{ latitude: lat, longitude: lng }]
      : [];
  });
}

export default function SegmentsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { address } = useViemWallet();
  const activities = useActivityStore((s) => s.activities);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [only, setOnly] = useState<'nearby' | 'starred'>('nearby');
  const starred = useSegmentStarsStore((s) => s.starred);
  const toggleStar = useSegmentStarsStore((s) => s.toggle);
  const [creating, setCreating] = useState(false);

  const candidates = useMemo(
    () => activities.filter((a) => !a.isManual && a.polyline && trackOf(a).length >= 2).slice(0, 5),
    [activities]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted')
        throw new Error('Location permission is needed to find nearby segments.');
      const fix =
        (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync());
      const here = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
      setPosition(here);
      const result = await nearbySegments(here.latitude, here.longitude);
      setSegments(result.segments);
      setError(null);
    } catch (e) {
      setError(
        isNotConfigured(e)
          ? 'Segments are not switched on for this server yet.'
          : friendlyError(e, "Segments can't load right now. Try again in a moment.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const shown = useMemo(
    () => (only === 'starred' ? starredList(starred) : segments),
    [only, starred, segments]
  );

  const sorted = useMemo(() => {
    if (!position) return shown;
    return [...shown].sort(
      (a, b) =>
        haversineDistance(
          position.latitude,
          position.longitude,
          a.start.latitude,
          a.start.longitude
        ) -
        haversineDistance(
          position.latitude,
          position.longitude,
          b.start.latitude,
          b.start.longitude
        )
    );
  }, [shown, position]);

  const create = async () => {
    const activity = candidates.find((a) => a.id === selectedId);
    if (!activity || !address || !name.trim()) return;
    setCreating(true);
    try {
      const sportType = Math.max(
        0,
        SPORT_TYPES.findIndex((s) => s.type === activity.activityType)
      );
      const created = await createSegment({
        name: name.trim(),
        sportType,
        creator: address,
        track: trackOf(activity),
      });
      Toast.success('Segment published to Arkiv', 2);
      setName('');
      setSelectedId(null);
      router.push({ pathname: '/segment-detail', params: { key: created.key } });
    } catch (e) {
      Alert.alert('Could not create segment', (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.flex}>
        <ScreenHeader title="Segments" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary">
            Community segments live on Arkiv. Efforts are attested by Stryde and owned by you;
            ranked boards only count World ID–linked humans.
          </ThemedText>

          <ChipRow options={FILTERS} value={only} onChange={setOnly} contentStyle={styles.chips} />

          {loading && only === 'nearby' && <ActivityIndicator color={theme.brand.primary} />}
          {error && only === 'nearby' && (
            <Card style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
              <AppButton variant="secondary" onPress={() => void load()}>
                Try again
              </AppButton>
            </Card>
          )}

          {sorted.length === 0 && only === 'starred' && (
            <Card style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                Star a segment to keep it here, even with no signal.
              </ThemedText>
            </Card>
          )}

          {!loading && !error && sorted.length === 0 && only === 'nearby' && (
            <Card style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                No segments near you yet. Create the first one from a recent run below.
              </ThemedText>
            </Card>
          )}

          {sorted.map((segment) => (
            <TouchableOpacity
              key={segment.key}
              onPress={() =>
                router.push({ pathname: '/segment-detail', params: { key: segment.key } })
              }
              accessibilityRole="button"
            >
              <Card style={styles.segmentRow}>
                <Ionicons name="flag" size={20} color={theme.brand.primary} />
                <ThemedView style={styles.flex}>
                  <ThemedText type="smallBold">{segment.name}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {formatDistance(segment.distanceM)}
                    {position
                      ? ` · ${formatDistance(
                          haversineDistance(
                            position.latitude,
                            position.longitude,
                            segment.start.latitude,
                            segment.start.longitude
                          )
                        )} away`
                      : ''}
                  </ThemedText>
                </ThemedView>
                <TouchableOpacity
                  onPress={() => toggleStar(segment)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={starred[segment.key] ? 'Unstar segment' : 'Star segment'}
                >
                  <Ionicons
                    name={starred[segment.key] ? 'star' : 'star-outline'}
                    size={20}
                    color={theme.brand.primary}
                  />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </Card>
            </TouchableOpacity>
          ))}

          <Card style={styles.card}>
            <ThemedText type="sectionTitle">Create a segment</ThemedText>
            {candidates.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Record a run first, then turn its route into a segment.
              </ThemedText>
            ) : (
              <>
                {candidates.map((activity) => {
                  const selected = activity.id === selectedId;
                  return (
                    <TouchableOpacity
                      key={activity.id}
                      onPress={() => setSelectedId(activity.id)}
                      style={[
                        styles.choice,
                        {
                          borderColor: selected ? theme.brand.primary : theme.border,
                          backgroundColor: selected ? Brand.primaryTint : 'transparent',
                        },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <ThemedText type="small">{activity.name ?? 'Activity'}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {formatDistance(activity.distance)} ·{' '}
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
                <TextField
                  placeholder="Segment name, e.g. Marine Drive sprint"
                  value={name}
                  onChangeText={setName}
                />
                <AppButton
                  onPress={create}
                  loading={creating}
                  disabled={!selectedId || !name.trim() || creating || !address}
                >
                  Publish to Arkiv
                </AppButton>
              </>
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  card: { gap: Spacing.three },
  chips: { paddingHorizontal: 0 },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  choice: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
    gap: Spacing.half,
  },
});
