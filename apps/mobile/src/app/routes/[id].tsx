import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { ListMessage } from '@/components/list-message';
import { MapRoute } from '@/components/map-route';
import { OfflineMapCard } from '@/components/offline-map-card';
import { RouteElevationCard } from '@/components/route-elevation-card';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { mapboxStyleUrl } from '@/constants/mapboxStyle';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useGoBack } from '@/hooks/useGoBack';
import { useOfflineRouteMap } from '@/hooks/useOfflineRouteMap';
import { useRouteElevation } from '@/hooks/useRouteElevation';
import { useFollowRouteStore } from '@/stores/followRouteStore';
import { resolveMapStyle, useMapPrefsStore } from '@/stores/mapPrefsStore';
import { useRouteStore } from '@/stores/routeStore';
import { confirmDeleteRoute } from '@/utils/confirmDeleteRoute';
import { formatDistance, parsePolyline, SPORT_LABEL } from '@/utils/format';
import { toGpx } from '@/utils/gpx';
import { routeBounds } from '@/utils/routeBounds';
import { shareGpx } from '@/utils/share';
import { Toast } from '@/utils/toast';

const MAP_HEIGHT = 260;
const MAP_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

/** One saved route: its line, the hills along it, and ways to keep or send it. */
export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const goBack = useGoBack();
  const unitSystem = useUnitSystem();
  const stylePref = useMapPrefsStore((s) => s.style);
  const mapType = useMapPrefsStore((s) => s.mapType);
  const dark = resolveMapStyle(stylePref, theme.isDark) === 'dark';
  const route = useRouteStore((s) => s.routes.find((r) => r.id === id));
  const { rename, remove, toggleStar } = useRouteStore.getState();
  const line = useMemo(() => parsePolyline(route?.polyline ?? ''), [route?.polyline]);
  const elevation = useRouteElevation(line);
  const [name, setName] = useState<string | null>(null);
  const offline = useOfflineRouteMap(id ?? '', line, mapboxStyleUrl(dark, mapType));

  if (!route) {
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.container}>
          <ListMessage
            fill
            icon="map-outline"
            text="This route is no longer saved."
            action={{ label: 'Back', onPress: goBack }}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const bounds = routeBounds(line);
  const start = line[0];
  const finish = line.at(-1);
  const exportGpx = () => {
    const gpx = toGpx({
      name: route.name,
      activityType: route.sport,
      startedAt: new Date(route.savedAt),
      route: line,
      elevations: elevation.status === 'ready' ? elevation.elevations : undefined,
    });
    if (gpx) void shareGpx(route.name, gpx);
  };
  const confirmDelete = () =>
    confirmDeleteRoute(route.name, () => {
      remove(route.id);
      Toast.info('Route deleted', 1);
      goBack();
    });
  const saveName = () => {
    if (name !== null) rename(route.id, name);
    setName(null);
  };

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
          <ThemedText
            type="sectionTitle"
            accessibilityRole="header"
            numberOfLines={1}
            style={styles.title}
          >
            {route.name}
          </ThemedText>
          <Tappable
            onPress={() => toggleStar(route.id)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityState={{ selected: route.starred === true }}
            accessibilityLabel={route.starred ? 'Remove star' : 'Star this route'}
          >
            <Ionicons
              name={route.starred ? 'star' : 'star-outline'}
              size={24}
              color={route.starred ? theme.brand.primary : theme.text}
            />
          </Tappable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.map}>
            <MapRoute
              coordinates={line.length > 1 ? line : undefined}
              initialBounds={bounds ? { bounds, padding: MAP_PADDING } : undefined}
              markers={
                start && finish && line.length > 1
                  ? [
                      { id: 'start', coordinate: start, color: theme.brand.success, icon: 'play' },
                      { id: 'finish', coordinate: finish, color: theme.brand.danger, icon: 'flag' },
                    ]
                  : []
              }
              dark={dark}
              mapType={mapType}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {`${formatDistance(route.distance, unitSystem)} · ${SPORT_LABEL[route.sport] ?? route.sport}`}
          </ThemedText>
          <RouteElevationCard line={line} elevation={elevation} />
          <OfflineMapCard
            status={offline.status}
            onDownload={() => void offline.download()}
            onRemove={() => void offline.remove()}
          />
          {name === null ? (
            <View style={styles.actions}>
              <AppButton onPress={() => router.push(`/flyover?routeId=${route.id}`)}>
                Fly over route
              </AppButton>
              <AppButton
                disabled={line.length < 2}
                onPress={() => {
                  useFollowRouteStore.getState().follow({ id: route.id, name: route.name, line });
                  router.push('/(tabs)/tracking');
                }}
              >
                Use this route
              </AppButton>
              <AppButton variant="secondary" onPress={exportGpx}>
                Export GPX
              </AppButton>
              <AppButton variant="secondary" onPress={() => setName(route.name)}>
                Rename
              </AppButton>
              <AppButton
                variant="secondary"
                onPress={() => router.push(`/(tabs)/map?route=${route.id}`)}
              >
                Show on map
              </AppButton>
              <AppButton variant="danger" onPress={confirmDelete}>
                Delete route
              </AppButton>
            </View>
          ) : (
            <View style={styles.actions}>
              <TextField
                label="Route name"
                value={name}
                onChangeText={setName}
                maxLength={60}
                autoFocus
              />
              <AppButton onPress={saveName}>Save name</AppButton>
              <AppButton variant="ghost" onPress={() => setName(null)}>
                Cancel
              </AppButton>
            </View>
          )}
        </ScrollView>
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
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  title: { flex: 1, textAlign: 'center' },
  body: { padding: Spacing.four, gap: Spacing.three },
  map: { height: MAP_HEIGHT, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  actions: { gap: Spacing.two },
});
