import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListMessage } from '@/components/list-message';
import { RouteFlyover } from '@/components/route-flyover';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useGoBack } from '@/hooks/useGoBack';
import { useActivityStore } from '@/stores/activityStore';
import { resolveMapStyle, useMapPrefsStore } from '@/stores/mapPrefsStore';
import { useRouteStore } from '@/stores/routeStore';
import { parsePolyline } from '@/utils/format';

/** The route of a saved route (`?routeId=`) or a recorded activity (`?activityId=`), flown over on a tilted map. */
export default function FlyoverScreen() {
  const { routeId, activityId } = useLocalSearchParams<{ routeId?: string; activityId?: string }>();
  const theme = useTheme();
  const goBack = useGoBack();
  const stylePref = useMapPrefsStore((s) => s.style);
  const route = useRouteStore((s) => s.routes.find((r) => r.id === routeId));
  const activity = useActivityStore((s) => s.activities.find((a) => a.id === activityId));
  const polyline = route?.polyline ?? activity?.polyline ?? '';
  const title = route?.name ?? activity?.name ?? 'Flyover';
  const line = useMemo(() => parsePolyline(polyline), [polyline]);

  if (line.length < 2) {
    return (
      <ThemedView type="background" style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ListMessage
            fill
            icon="map-outline"
            title="Nothing to fly over"
            text="This one has no route line, so there is no path to follow."
            action={{ label: 'Back', onPress: goBack }}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <RouteFlyover
      line={line}
      title={title}
      dark={resolveMapStyle(stylePref, theme.isDark) === 'dark'}
      onClose={goBack}
    />
  );
}
