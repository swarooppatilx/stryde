import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { RouteThumbnail } from '@/components/route-thumbnail';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { getSportIcon } from '@/constants/activity';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import type { SavedRoute } from '@/stores/routeStore';
import { formatDistance, formatDuration, formatElevation } from '@/utils/format';
import { DIFFICULTY_LABEL, routeDifficulty } from '@/utils/routeDifficulty';

const THUMBNAIL_HEIGHT = 120;

interface RouteCardProps {
  route: SavedRoute;
  onPress(): void;
  onLongPress?(): void;
  /** The star on the card's corner; left out, no star shows. */
  onToggleStar?(): void;
  onDelete?(): void;
  /** The route's map is on the phone, so it works with no signal. */
  downloaded?: boolean;
}

/** A saved route as a card: its line on the map, then the facts a runner picks by (sport, difficulty, distance, climb, time). */
export function RouteCard({
  route,
  onPress,
  onLongPress,
  onToggleStar,
  onDelete,
  downloaded = false,
}: RouteCardProps) {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const difficulty = routeDifficulty(route);

  const facts = [
    formatDistance(route.distance, unitSystem),
    route.elevationGain === undefined
      ? null
      : `${formatElevation(route.elevationGain, unitSystem)} up`,
    route.duration === undefined ? null : formatDuration(route.duration),
  ].filter((fact): fact is string => fact !== null);

  return (
    <Tappable
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${route.name}, ${facts.join(', ')}${difficulty ? `, ${DIFFICULTY_LABEL[difficulty]}` : ''}`}
    >
      <View style={styles.thumbnail}>
        <RouteThumbnail polyline={route.polyline} height={THUMBNAIL_HEIGHT} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Ionicons name={getSportIcon(route.sport)} size={18} color={theme.brand.primary} />
          <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
            {route.name}
          </ThemedText>
          {onToggleStar ? (
            <Tappable
              onPress={onToggleStar}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityState={{ selected: route.starred === true }}
              accessibilityLabel={
                route.starred ? `Remove star from ${route.name}` : `Star ${route.name}`
              }
            >
              <Ionicons
                name={route.starred ? 'star' : 'star-outline'}
                size={20}
                color={route.starred ? theme.brand.primary : theme.textSecondary}
              />
            </Tappable>
          ) : null}
          {onDelete ? (
            <Tappable
              onPress={onDelete}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${route.name}`}
            >
              <Ionicons name="trash-outline" size={19} color={theme.textSecondary} />
            </Tappable>
          ) : null}
        </View>
        <View style={styles.factsRow}>
          {downloaded ? (
            <View
              style={[
                styles.pill,
                styles.offlinePill,
                { backgroundColor: theme.backgroundSelected },
              ]}
              accessibilityLabel="Available offline"
            >
              <Ionicons name="cloud-done-outline" size={13} color={theme.brand.success} />
              <ThemedText type="caption">Offline</ThemedText>
            </View>
          ) : null}
          {difficulty ? (
            <View style={[styles.pill, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="caption">{DIFFICULTY_LABEL[difficulty]}</ThemedText>
            </View>
          ) : null}
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {facts.join(' · ')}
          </ThemedText>
        </View>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  thumbnail: { width: '100%' },
  body: { padding: Spacing.three, gap: Spacing.one },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1 },
  factsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  offlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: BorderRadius.full },
});
