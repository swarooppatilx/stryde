import { Ionicons } from '@expo/vector-icons';
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  Marker,
  NativeUserLocation,
} from '@maplibre/maplibre-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { territoryService } from '@/services/territoryService';
import type { Ring } from '@/types';
import { formatArea } from '@/utils/format';

export interface MapMarker {
  id: string;
  coordinate: [number, number];
  color: string;
  icon?: string;
  label?: string;
}

export interface ActivityRoute {
  id: string;
  coordinates: [number, number][];
  color: string;
  lineWidth?: number;
}

export interface MapRouteProps {
  coordinates?: [number, number][];
  territoryPolygons?: Ring[];
  territoryColor?: string;
  territoryOpacity?: number;
  markers?: MapMarker[];
  followUser?: 'default' | 'heading' | 'course' | undefined;
  initialCenter?: [number, number];
  initialZoom?: number;
  style?: ViewStyle;
  showUserLocation?: boolean;
  mapStyleUrl?: string;
  cameraRef?: React.RefObject<CameraRef | null>;
  activityRoutes?: ActivityRoute[];
}

class MapErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function MapRouteFallback({
  coordinates,
  territoryPolygons = [],
  markers = [],
  initialCenter = [73.851074, 18.524209],
  style,
}: MapRouteProps) {
  const theme = useTheme();
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);

  const routePoints = useMemo(() => {
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

    const startPt = points[0].split(',').map(Number) as [number, number];
    const endPt = points[points.length - 1].split(',').map(Number) as [number, number];

    return {
      polyline: points.join(' '),
      start: startPt,
      end: endPt,
    };
  }, [coordinates, layout]);

  const totalTerritoryArea = useMemo(
    () => territoryPolygons.reduce((sum, ring) => sum + territoryService.getPolygonArea(ring), 0),
    [territoryPolygons]
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
      {/* Decorative background grid lines */}
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

          {/* SVG Route Visualization when GPS points exist */}
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
                stroke="#fff"
                strokeWidth={2}
              />
              <Circle
                cx={routePoints.end[0]}
                cy={routePoints.end[1]}
                r={7}
                fill={Brand.danger}
                stroke="#fff"
                strokeWidth={2}
              />
            </>
          )}
        </Svg>
      )}

      {/* Markers overlay */}
      {!routePoints && markers.length > 0 && (
        <View style={styles.fallbackCenterContainer}>
          <View
            style={[styles.markerOuter, { backgroundColor: markers[0]?.color ?? Brand.primary }]}
          >
            <View style={styles.markerInner}>
              <Ionicons
                name={(markers[0]?.icon || 'location') as keyof typeof Ionicons.glyphMap}
                size={14}
                color="#fff"
              />
            </View>
          </View>
        </View>
      )}

      {/* Top badges */}
      <View style={styles.fallbackBadgeRow}>
        {totalTerritoryArea > 0 && (
          <ThemedView style={[styles.fallbackPill, { backgroundColor: theme.background }]}>
            <Ionicons name="map" size={14} color={Brand.primary} />
            <ThemedText type="small" style={{ color: Brand.primary, fontWeight: '700' }}>
              {formatArea(totalTerritoryArea)} captured
            </ThemedText>
          </ThemedView>
        )}
        {coordinates && coordinates.length > 1 && (
          <ThemedView style={[styles.fallbackPill, { backgroundColor: theme.background }]}>
            <Ionicons name="navigate-outline" size={14} color={theme.text} />
            <ThemedText type="small" style={{ color: theme.text, fontWeight: '600' }}>
              {coordinates.length} points
            </ThemedText>
          </ThemedView>
        )}
      </View>

      {/* Center state when no route */}
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

function MapLibreRouteInternal({
  coordinates,
  territoryPolygons = [],
  territoryColor = Brand.primary,
  territoryOpacity = 0.25,
  markers = [],
  followUser,
  initialCenter = [73.851074, 18.524209],
  initialZoom = 15,
  style,
  showUserLocation = true,
  mapStyleUrl,
  cameraRef,
  activityRoutes = [],
}: MapRouteProps) {
  const routeGeoJSON = useMemo(() => {
    if (!coordinates || coordinates.length < 2) return null;
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates,
          },
          properties: {},
        },
      ],
    };
  }, [coordinates]);

  const territoryGeoJSON = useMemo(() => {
    if (territoryPolygons.length === 0) return null;
    return {
      type: 'FeatureCollection' as const,
      features: territoryPolygons.map((ring) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [ring],
        },
        properties: {},
      })),
    };
  }, [territoryPolygons]);

  const cameraCenter =
    coordinates && coordinates.length > 0
      ? coordinates[Math.floor(coordinates.length / 2)]
      : initialCenter;

  const resolvedMapStyle = mapStyleUrl ?? 'https://tiles.openfreemap.org/styles/liberty';

  return (
    <MapLibreMap style={[styles.map, style]} mapStyle={resolvedMapStyle}>
      <Camera
        ref={cameraRef}
        initialViewState={{
          center: cameraCenter,
          zoom: initialZoom,
        }}
        trackUserLocation={followUser}
      />

      {showUserLocation && NativeUserLocation && (
        <NativeUserLocation
          mode={
            followUser === 'heading'
              ? 'heading'
              : followUser === 'course'
                ? 'course'
                : followUser
                  ? 'default'
                  : undefined
          }
        />
      )}

      {territoryGeoJSON && (
        <GeoJSONSource id="territory" data={territoryGeoJSON}>
          <Layer
            id="territory-fill"
            source="territory"
            type="fill"
            paint={{
              'fill-color': territoryColor,
              'fill-opacity': territoryOpacity,
            }}
          />
          <Layer
            id="territory-border"
            source="territory"
            type="line"
            paint={{
              'line-color': territoryColor,
              'line-width': 2,
              'line-opacity': 0.8,
            }}
          />
        </GeoJSONSource>
      )}

      {routeGeoJSON && (
        <GeoJSONSource id="route" data={routeGeoJSON}>
          <Layer
            id="route-glow"
            type="line"
            source="route"
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': Brand.primary,
              'line-width': 8,
              'line-opacity': 0.25,
            }}
          />
          <Layer
            id="route-line"
            type="line"
            source="route"
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': Brand.primary,
              'line-width': 4,
            }}
          />
        </GeoJSONSource>
      )}

      {activityRoutes.map((route) => (
        <GeoJSONSource
          key={route.id}
          id={`activity-${route.id}`}
          data={{
            type: 'FeatureCollection' as const,
            features: [
              {
                type: 'Feature' as const,
                geometry: { type: 'LineString' as const, coordinates: route.coordinates },
                properties: {},
              },
            ],
          }}
        >
          {route.lineWidth && route.lineWidth > 2 && (
            <Layer
              id={`activity-glow-${route.id}`}
              type="line"
              source={`activity-${route.id}`}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
              paint={{
                'line-color': route.color,
                'line-width': route.lineWidth + 4,
                'line-opacity': 0.2,
              }}
            />
          )}
          <Layer
            id={`activity-line-${route.id}`}
            type="line"
            source={`activity-${route.id}`}
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': route.color,
              'line-width': route.lineWidth ?? 2,
              'line-opacity': route.lineWidth ? 1 : 0.6,
            }}
          />
        </GeoJSONSource>
      ))}

      {markers.map((marker) => (
        <Marker
          key={marker.id}
          lngLat={[marker.coordinate[0], marker.coordinate[1]]}
          anchor="center"
        >
          <View style={[styles.markerOuter, { backgroundColor: marker.color }]}>
            <View style={styles.markerInner}>
              <Ionicons
                name={(marker.icon || 'location') as keyof typeof Ionicons.glyphMap}
                size={14}
                color="#fff"
              />
            </View>
          </View>
        </Marker>
      ))}
    </MapLibreMap>
  );
}

export function MapRoute(props: MapRouteProps) {
  return (
    <MapErrorBoundary fallback={<MapRouteFallback {...props} />}>
      <MapLibreRouteInternal {...props} />
    </MapErrorBoundary>
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
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  markerInner: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.3)',
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
});
