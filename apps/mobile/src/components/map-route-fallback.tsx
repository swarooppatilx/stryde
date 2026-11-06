import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import type { MapRouteProps } from '@/components/map-route';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DEFAULT_CENTER } from '@/constants/config';
import { Palette } from '@/constants/palette';
import { BorderRadius, Brand, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { territoryService } from '@/services/territoryService';
import { formatArea } from '@/utils/format';

/** A round marker with an icon; shared by the live map and its fallback. */
export function MapPin({ color, icon }: { color: string; icon?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.markerOuter, theme.shadows.pin, { backgroundColor: color }]}>
      <View style={styles.markerInner}>
        <Ionicons
          name={(icon || 'location') as keyof typeof Ionicons.glyphMap}
          size={14}
          color={Palette.white}
        />
      </View>
    </View>
  );
}

export class MapErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function fallbackRoutePoints(
  coordinates: MapRouteProps['coordinates'],
  layout: { width: number; height: number } | null
): { polyline: string; start: [number, number]; end: [number, number] } | null {
  if (!coordinates || coordinates.length < 2 || !layout) return null;

  const pad = 40;
  const w = Math.max(layout.width - pad * 2, 10);
  const h = Math.max(layout.height - pad * 2, 10);

  const lngs = coordinates.map((c) => c[0]);
  const lats = coordinates.map((c) => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const lngSpan = maxLng - minLng || 0.0005;
  const latSpan = maxLat - minLat || 0.0005;

  const points = coordinates.map(([lng, lat]) => {
    const x = pad + ((lng - minLng) / lngSpan) * w;
    const y = pad + (1 - (lat - minLat) / latSpan) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const toPoint = (p: string | undefined) =>
    (p ?? '0,0').split(',').map(Number) as [number, number];
  const startPt = toPoint(points[0]);
  const endPt = toPoint(points.at(-1));

  return {
    polyline: points.join(' '),
    start: startPt,
    end: endPt,
  };
}

export function MapRouteFallback({
  coordinates,
  territoryPolygons = [],
  markers = [],
  initialCenter = DEFAULT_CENTER,
  style,
}: MapRouteProps) {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);

  const routePoints = fallbackRoutePoints(coordinates, layout);

  const totalTerritoryArea = territoryPolygons.reduce(
    (sum, ring) => sum + territoryService.getPolygonArea(ring),
    0
  );

  return (
    <View
      style={[styles.map, { backgroundColor: theme.backgroundElement }, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setLayout({ width, height });
        }
      }}
    >
      {layout && (
        <Svg width={layout.width} height={layout.height} style={StyleSheet.absoluteFill}>
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
            <Line
              key={`h-${ratio}`}
              x1={0}
              y1={layout.height * ratio}
              x2={layout.width}
              y2={layout.height * ratio}
              stroke={theme.border}
              strokeWidth={1}
              strokeDasharray="4 6"
              opacity={0.6}
            />
          ))}
          {[0.25, 0.5, 0.75].map((ratio) => (
            <Line
              key={`v-${ratio}`}
              x1={layout.width * ratio}
              y1={0}
              x2={layout.width * ratio}
              y2={layout.height}
              stroke={theme.border}
              strokeWidth={1}
              strokeDasharray="4 6"
              opacity={0.6}
            />
          ))}

          {routePoints && (
            <>
              <Polyline
                points={routePoints.polyline}
                fill="none"
                stroke={Brand.primary}
                strokeWidth={10}
                strokeOpacity={0.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Polyline
                points={routePoints.polyline}
                fill="none"
                stroke={Brand.primary}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Circle
                cx={routePoints.start[0]}
                cy={routePoints.start[1]}
                r={7}
                fill={Brand.success}
                stroke={Palette.white}
                strokeWidth={2}
              />
              <Circle
                cx={routePoints.end[0]}
                cy={routePoints.end[1]}
                r={7}
                fill={Brand.danger}
                stroke={Palette.white}
                strokeWidth={2}
              />
            </>
          )}
        </Svg>
      )}

      {!routePoints && markers.length > 0 && (
        <View style={styles.fallbackCenterContainer}>
          <MapPin color={markers[0]?.color ?? Brand.primary} icon={markers[0]?.icon} />
        </View>
      )}

      <View style={styles.fallbackBadgeRow}>
        {totalTerritoryArea > 0 && (
          <ThemedView
            style={[styles.fallbackPill, theme.shadows.card, { backgroundColor: theme.background }]}
          >
            <Ionicons name="map" size={14} color={Brand.primary} />
            <ThemedText type="small" style={{ color: Brand.primary, fontWeight: '700' }}>
              {formatArea(totalTerritoryArea, unitSystem)} captured
            </ThemedText>
          </ThemedView>
        )}
        {coordinates && coordinates.length > 1 && (
          <ThemedView
            style={[styles.fallbackPill, theme.shadows.card, { backgroundColor: theme.background }]}
          >
            <Ionicons name="navigate-outline" size={14} color={theme.text} />
            <ThemedText type="small" style={{ color: theme.text, fontWeight: '600' }}>
              {coordinates.length} points
            </ThemedText>
          </ThemedView>
        )}
      </View>

      {!coordinates && (
        <View style={styles.fallbackCenterContainer}>
          <Ionicons name="map-outline" size={38} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.one }}>
            {initialCenter[1].toFixed(4)}°N, {initialCenter[0].toFixed(4)}°E
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  markerOuter: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Brand.white,
  },
  markerInner: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: tint(Palette.white, 0.3),
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackCenterContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackBadgeRow: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  fallbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: BorderRadius.full,
  },
});
