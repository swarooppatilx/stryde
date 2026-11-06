import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import type { SportFilter } from '@/components/filter-chips';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { formatDistance, formatDuration } from '@/utils/format';
import { distanceTo, etaMs, type MapPoi, poiIcon } from '@/utils/poi';

const SPORT_VERB: Record<SportFilter, string> = {
  all: 'walking',
  run: 'running',
  ride: 'riding',
  hike: 'hiking',
  swim: 'walking',
  multi: 'walking',
};

interface PoiCardProps {
  poi: MapPoi;
  /** The athlete's position, for distance and arrival time; null hides them. */
  from: { latitude: number; longitude: number } | null;
  sport: SportFilter;
  onClose(): void;
  /** Plans a route from the athlete to the place. */
  onRouteHere?: (poi: MapPoi) => void;
  /** Opens the route builder with the place as the start. */
  onStartHere?: (poi: MapPoi) => void;
  /** Offers loops that start and finish at the place. */
  onLoopsFromHere?: (poi: MapPoi) => void;
}

/** A tapped café, water point or viewpoint: what it is, how far, and how long to get there. */
export function PoiCard({
  poi,
  from,
  sport,
  onClose,
  onRouteHere,
  onStartHere,
  onLoopsFromHere,
}: PoiCardProps) {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const distance = from ? distanceTo(from, poi) : null;

  return (
    <View
      style={[styles.card, theme.shadows.sheet, { backgroundColor: theme.backgroundElement }]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: theme.brand.primaryTint }]}>
          <Ionicons name={poiIcon(poi.maki)} size={20} color={theme.brand.primary} />
        </View>
        <View style={styles.title}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {poi.name}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {poi.kind}
          </ThemedText>
        </View>
        <Tappable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Close ${poi.name}`}
        >
          <Ionicons name="close" size={20} color={theme.textSecondary} />
        </Tappable>
      </View>

      {distance !== null && (
        <View style={styles.stats}>
          <View style={[styles.stat, { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold">{formatDistance(distance, unitSystem)}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Away
            </ThemedText>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold">~{formatDuration(etaMs(distance, sport))}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {SPORT_VERB[sport]}
            </ThemedText>
          </View>
        </View>
      )}

      {onRouteHere && (
        <Tappable
          style={[styles.action, { backgroundColor: theme.brand.primary }]}
          onPress={() => onRouteHere(poi)}
          accessibilityRole="button"
          accessibilityLabel={`Plan a route to ${poi.name}`}
        >
          <Ionicons name="navigate" size={16} color={Palette.white} />
          <ThemedText type="smallBold" style={{ color: Palette.white }}>
            Route here
          </ThemedText>
        </Tappable>
      )}
      {(onStartHere || onLoopsFromHere) && (
        <View style={styles.secondary}>
          {onStartHere && (
            <Tappable
              style={[styles.secondaryAction, { borderColor: theme.border }]}
              onPress={() => onStartHere(poi)}
              accessibilityRole="button"
              accessibilityLabel={`Plan a route starting at ${poi.name}`}
            >
              <Ionicons name="flag-outline" size={16} color={theme.text} />
              <ThemedText type="smallBold">Start here</ThemedText>
            </Tappable>
          )}
          {onLoopsFromHere && (
            <Tappable
              style={[styles.secondaryAction, { borderColor: theme.border }]}
              onPress={() => onLoopsFromHere(poi)}
              accessibilityRole="button"
              accessibilityLabel={`Find loops from ${poi.name}`}
            >
              <Ionicons name="sync-outline" size={16} color={theme.text} />
              <ThemedText type="smallBold">Loops from here</ThemedText>
            </Tappable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.four,
    borderRadius: BorderRadius.xl,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  icon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1 },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: 2,
  },
  secondary: { flexDirection: 'row', gap: Spacing.two },
  secondaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  action: {
    minHeight: 44,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
