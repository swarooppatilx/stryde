import { StyleSheet, View } from 'react-native';
import { ScrubChart } from '@/components/scrub-chart';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import type { RouteElevation } from '@/hooks/useRouteElevation';
import { formatDistance, formatElevation } from '@/utils/format';
import type { RoutePoint } from '@/utils/route';
import { routeProfile } from '@/utils/routeProfile';

interface Props {
  line: RoutePoint[];
  elevation: RouteElevation;
}

/** Elevation along a route with the climb and descent, from the ground height lookup. */
export function RouteElevationCard({ line, elevation }: Props) {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const profile = elevation.status === 'ready' ? routeProfile(line, elevation.elevations) : null;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      {profile ? (
        <ScrubChart
          title="Elevation"
          values={profile.values}
          times={profile.times}
          formatValue={(v) => formatElevation(v, unitSystem)}
          minRange={30}
          summary={`${formatElevation(profile.gain, unitSystem)} up, ${formatElevation(profile.loss, unitSystem)} down`}
          accessibilityLabel={`Elevation along the route, ${formatElevation(profile.gain, unitSystem)} up and ${formatElevation(profile.loss, unitSystem)} down over ${formatDistance(profile.total, unitSystem)}. Drag across it to read a point.`}
        />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {elevation.status === 'loading'
            ? 'Reading the hills…'
            : 'Elevation needs a connection. Try again when you are online.'}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: BorderRadius.lg, gap: Spacing.two },
});
