import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { MapRoute } from '@/components/map-route';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ARKIV_EXPLORER, type Beacon, getBeacon } from '@/services/arkivService';
import { StrydeApiError } from '@/services/strydeApi';

const POLL_MS = 10_000;

function formatPaceSec(secPerKm: number): string {
  if (!secPerKm) return '—';
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, '0')} /km`;
}

function formatAge(secondsAgo: number | null): string {
  if (secondsAgo !== null && secondsAgo < 60) return `${secondsAgo}s`;
  return `${Math.round((secondsAgo ?? 0) / 60)}m`;
}

export default function LiveBeaconScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const theme = useTheme();
  const [beacon, setBeacon] = useState<Beacon | null>(null);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await getBeacon(runId);
        if (!cancelled) {
          setBeacon(next);
          setEnded(false);
          setError(null);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof StrydeApiError && e.status === 404) setEnded(true);
        else setError((e as Error).message);
      }
    };
    void poll();
    const timer = setInterval(() => {
      void poll();
      setNow(Date.now());
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [runId]);

  const secondsAgo = beacon ? Math.max(0, Math.round((now - beacon.updatedAt) / 1000)) : null;

  const liveStatus = beacon ? (
    <Card style={styles.card}>
      <ThemedView style={styles.liveRow}>
        <View style={[styles.dot, { backgroundColor: Brand.danger }]} />
        <ThemedText type="smallBold">LIVE · updated {formatAge(secondsAgo)} ago</ThemedText>
      </ThemedView>
      <ThemedText type="sectionTitle">{formatPaceSec(beacon.paceSecPerKm)}</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {beacon.athlete.slice(0, 6)}…{beacon.athlete.slice(-4)}
        {beacon.batteryPct === null ? '' : ` · battery ${beacon.batteryPct}%`}
      </ThemedText>
      <TouchableOpacity onPress={() => Linking.openURL(`${ARKIV_EXPLORER}/entity/${beacon.key}`)}>
        <ThemedView style={styles.liveRow}>
          <Ionicons name="open-outline" size={14} color={theme.brand.primary} />
          <ThemedText type="small" style={{ color: theme.brand.primary }}>
            Beacon entity on Arkiv
          </ThemedText>
        </ThemedView>
      </TouchableOpacity>
    </Card>
  ) : (
    <ThemedText type="small" themeColor="textSecondary">
      {error ?? 'Finding the runner…'}
    </ThemedText>
  );

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.flex}>
        <ScreenHeader title="Live run" />
        <View style={styles.map}>
          <MapRoute
            key={beacon ? `${beacon.latitude},${beacon.longitude}` : 'empty'}
            markers={
              beacon
                ? [
                    {
                      id: 'runner',
                      coordinate: [beacon.longitude, beacon.latitude],
                      color: Brand.danger,
                      icon: 'walk',
                    },
                  ]
                : []
            }
            initialCenter={beacon ? [beacon.longitude, beacon.latitude] : undefined}
            initialZoom={15}
          />
        </View>
        <View style={styles.body}>
          {ended ? (
            <Card style={styles.card}>
              <ThemedText type="sectionTitle">This run has ended</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Live beacons expire on Arkiv 10 minutes after the last update. Nothing about the
                live location is kept.
              </ThemedText>
            </Card>
          ) : (
            liveStatus
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  map: {
    flex: 1,
    marginHorizontal: Spacing.four,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  body: { padding: Spacing.four },
  card: { gap: Spacing.two },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
