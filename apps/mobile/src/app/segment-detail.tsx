import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { type MapMarker, MapRoute } from '@/components/map-route';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useViemWallet } from '@/hooks/useViemWallet';
import {
  ARKIV_EXPLORER,
  type Effort,
  getSegment,
  type Segment,
  segmentLeaderboard,
} from '@/services/arkivService';
import { useSegmentStarsStore } from '@/stores/segmentStarsStore';
import { formatDistance, formatDurationLong } from '@/utils/format';

const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function SegmentDetailScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const theme = useTheme();
  const { address } = useViemWallet();
  const [segment, setSegment] = useState<Segment | null>(null);
  const [scope, setScope] = useState<'verified' | 'all'>('verified');
  const [efforts, setEfforts] = useState<Effort[]>([]);
  const [loading, setLoading] = useState(true);
  const isStarred = useSegmentStarsStore((s) => Boolean(key && s.starred[key]));
  const toggleStar = useSegmentStarsStore((s) => s.toggle);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!key) return;
    setLoading(true);
    try {
      const [seg, board] = await Promise.all([getSegment(key), segmentLeaderboard(key, scope)]);
      setSegment(seg);
      setEfforts(board.efforts);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [key, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const markers: MapMarker[] = useMemo(
    () =>
      segment
        ? [
            {
              id: 'start',
              coordinate: [segment.start.longitude, segment.start.latitude],
              color: Brand.success,
              icon: 'play',
            },
            {
              id: 'end',
              coordinate: [segment.end.longitude, segment.end.latitude],
              color: Brand.danger,
              icon: 'flag',
            },
          ]
        : [],
    [segment]
  );

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.flex}>
        <ScreenHeader title={segment?.name ?? 'Segment'} />
        <ScrollView contentContainerStyle={styles.scroll}>
          {segment && (
            <View style={styles.map}>
              <MapRoute
                coordinates={[
                  [segment.start.longitude, segment.start.latitude],
                  [segment.end.longitude, segment.end.latitude],
                ]}
                markers={markers}
                initialCenter={[segment.start.longitude, segment.start.latitude]}
                initialZoom={14}
              />
            </View>
          )}

          {segment && (
            <ThemedView style={styles.metaRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDistance(segment.distanceM)} · created by {shortAddress(segment.creator)}
              </ThemedText>
              <TouchableOpacity
                onPress={() => toggleStar(segment)}
                accessibilityRole="button"
                accessibilityLabel={isStarred ? 'Unstar segment' : 'Star segment'}
              >
                <Ionicons
                  name={isStarred ? 'star' : 'star-outline'}
                  size={20}
                  color={theme.brand.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Linking.openURL(`${ARKIV_EXPLORER}/entity/${segment.key}`)}
              >
                <ThemedText type="small" style={{ color: theme.brand.primary }}>
                  View on Arkiv
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}

          <View style={styles.scopeRow}>
            {(['verified', 'all'] as const).map((value) => {
              const activeScope = scope === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setScope(value)}
                  style={[
                    styles.scopeOption,
                    {
                      backgroundColor: activeScope ? theme.brand.primary : theme.backgroundElement,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeScope }}
                >
                  <ThemedText
                    type="small"
                    style={{ color: activeScope ? Brand.white : theme.text, fontWeight: '600' }}
                  >
                    {value === 'verified' ? 'Verified humans' : 'Everyone'}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading && <ActivityIndicator color={theme.brand.primary} />}
          {error && (
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
          )}
          {!loading && !error && efforts.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {scope === 'verified'
                ? 'No efforts from World ID–linked athletes yet. Link yours in Coach and run it!'
                : 'No efforts yet. Be the first.'}
            </ThemedText>
          )}

          {efforts.map((effort, index) => {
            const mine = address && effort.athlete.toLowerCase() === address.toLowerCase();
            return (
              <Card
                key={effort.key}
                style={{
                  ...styles.effortRow,
                  ...(mine ? { borderWidth: 1, borderColor: theme.brand.primary } : {}),
                }}
              >
                <ThemedText type="sectionTitle" style={styles.rank}>
                  {index + 1}
                </ThemedText>
                <ThemedView style={styles.flex}>
                  <ThemedView style={styles.nameRow}>
                    <ThemedText type="smallBold">
                      {mine ? 'You' : shortAddress(effort.athlete)}
                    </ThemedText>
                    {effort.verifiedHuman && (
                      <Ionicons name="checkmark-circle" size={14} color={Brand.verified} />
                    )}
                    {effort.sweatVerified && (
                      <Ionicons name="heart" size={14} color={Brand.danger} />
                    )}
                  </ThemedView>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {new Date(effort.recordedAt).toLocaleDateString()}
                    {effort.avgBpm ? ` · ${effort.avgBpm} bpm avg` : ''}
                    {effort.sweatScore ? ` · sweat ${effort.sweatScore}` : ''}
                  </ThemedText>
                </ThemedView>
                <ThemedText type="smallBold">
                  {formatDurationLong(effort.elapsedSec * 1000)}
                </ThemedText>
              </Card>
            );
          })}

          <ThemedText type="caption" themeColor="textSecondary" style={styles.legend}>
            Blue check: World ID–linked human. Heart: wearable heart rate confirmed the effort.
          </ThemedText>
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
  map: {
    height: 200,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scopeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  scopeOption: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  effortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rank: { width: 28, textAlign: 'center' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legend: { textAlign: 'center' },
});
