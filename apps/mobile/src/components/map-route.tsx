import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  Marker,
  NativeUserLocation,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import React, { useMemo, useState } from 'react';
import { type NativeSyntheticEvent, StyleSheet, type ViewStyle } from 'react-native';
import { MapErrorBoundary, MapPin, MapRouteFallback } from '@/components/map-route-fallback';
import { offlineMapStyle } from '@/constants/mapStyle';
import { outdoorStyleFor } from '@/constants/outdoorMapStyle';
import { Palette } from '@/constants/palette';
import { Brand, HEAT_RAMP, OTHERS_TERRITORY_COLOR, Spacing } from '@/constants/theme';
import type { Ring } from '@/types';
import { type PuckPosition, puckFeatureCollection } from '@/utils/locationPuck';
import {
  type LngLatPair,
  routeFeatureCollection,
  type TerritoryFeatureInput,
  territoryFeatureCollection,
} from '@/utils/mapData';
import type { Bounds } from '@/utils/routeBounds';
import type { SplitMarker } from '@/utils/splitMarkers';

export interface MapMarker {
  id: string;
  coordinate: [number, number];
  color: string;
  icon?: string;
  label?: string;
}

/** A camera move reported by the map: `settled` when it has finished, `userInteraction` for a finger. */
export interface CameraMove {
  center: [number, number];
  zoom: number;
  bearing: number;
  userInteraction: boolean;
  settled: boolean;
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
  /** Same length and order as `territoryPolygons`; the on-chain territory id of each, for tap-to-owner. */
  territoryIds?: string[];
  territoryColor?: string;
  territoryOpacity?: number;
  markers?: MapMarker[];
  followUser?: 'default' | 'heading' | 'course' | undefined;
  /** Called with false when the athlete drags the map off the follow view, true when it follows again. */
  onFollowChange?: (following: boolean) => void;
  /** A tap on empty map (a tap on a territory also arrives here). */
  onMapPress?: () => void;
  /** A long press, at [lng, lat]. */
  onMapLongPress?: (lngLat: [number, number]) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
  /** Frames this box when the map first appears, so the route is in view before any later camera move. Wins over the centre and zoom. */
  initialBounds?: {
    bounds: Bounds;
    padding: { top: number; right: number; bottom: number; left: number };
  };
  style?: ViewStyle;
  /** Draws the athlete's position; mount it only once permission is granted and a fix exists, or the native layer logs errors. */
  showUserLocation?: boolean;
  dark?: boolean;
  /** Label parks and other places on the base map. */
  poi?: boolean;
  /** Draw cycle paths on the base map. */
  bikeLanes?: boolean;
  cameraRef?: React.RefObject<CameraRef | null>;
  activityRoutes?: ActivityRoute[];
  /** Top offset (px) of MapLibre's native compass; pass the bottom edge of any floating controls over the map. */
  compassTopOffset?: number;
  /** Other athletes' territory footprints (bounds-derived rectangles), each tagged with its territory id. */
  othersTerritories?: TerritoryFeatureInput[];
  othersTerritoryColor?: string;
  othersTerritoryOpacity?: number;
  /** Point cloud for the activity-density heatmap layer. */
  heatmapPoints?: LngLatPair[];
  heatmapVisible?: boolean;
  /** Colours of the heatmap, cool to hot; the classic ramp when left out. */
  heatmapRamp?: readonly (readonly [number, string])[];
  /** Fires with the territory id when a territory (own or another athlete's) is tapped. */
  onTerritoryPress?: (territoryId: string) => void;
  /** Keeps the parent's zoom state in sync (drives the 2D zoom buttons). */
  onZoomChanged?: (zoom: number) => void;
  /** Every camera move by a finger while it happens, and each move of any kind once it has finished. */
  onCameraMove?: (move: CameraMove) => void;
  /** Keeps the camera inside these zoom levels, for gestures and animations alike. */
  zoomRange?: { min: number; max: number };
  /**
   * The athlete's position, drawn as one puck (accuracy circle, dot, heading arrow) instead of the
   * native one. Null draws nothing yet; leave it undefined for no puck at all.
   */
  position?: PuckPosition | null;
  /** Fires once the map has loaded, so callers can frame the route then. */
  onMapReady?: () => void;
  /** The route cut into pieces coloured by how fast the athlete was; drawn instead of the plain line. */
  paceSegments?: ReadonlyArray<{ coordinates: LngLatPair[]; color: string }>;
  /** Numbered pins where each kilometre (or mile) ends along the route. */
  splitMarkers?: readonly SplitMarker[];
}

/** Split pins appear once the map is close enough for them not to crowd the line. */
const SPLIT_MARKER_MIN_ZOOM = 12;
const SPLIT_MARKER_RADIUS = ['interpolate', ['linear'], ['zoom'], 12, 6, 16, 9] as never;
const SPLIT_LABEL_SIZE = ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 11] as never;

/** Line widths grow with zoom so the route stays readable from a city view down to a street. */
const ROUTE_LINE_WIDTH = ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 4.5, 18, 7] as never;
/** The outline under the route on the dark base map: a pale, see-through edge, because a dark one vanishes into the map. */
const ROUTE_CASING_COLOR_DARK = '#c9d1dc';
const ROUTE_CASING_OPACITY_DARK = 0.4;
const ROUTE_CASING_OPACITY_LIGHT = 0.9;
const ROUTE_CASING_WIDTH = ['interpolate', ['linear'], ['zoom'], 10, 5.5, 15, 8, 18, 11] as never;

/** Some platform builds put `features` on the event itself rather than under `nativeEvent`. */
function topLevelFeatures(event: object): GeoJSON.Feature[] | undefined {
  return 'features' in event && Array.isArray(event.features) ? event.features : undefined;
}

function cameraMoveOf(
  event: { center: number[]; zoom: number; bearing: number; userInteraction: boolean },
  settled: boolean
): CameraMove {
  return {
    center: [event.center[0] as number, event.center[1] as number],
    zoom: event.zoom,
    bearing: event.bearing,
    userInteraction: event.userInteraction,
    settled,
  };
}

export function routeFeatureLine(
  coordinates: MapRouteProps['coordinates']
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const drawable = coordinates && coordinates.length >= 2;
  return {
    type: 'FeatureCollection' as const,
    features: drawable
      ? [
          {
            type: 'Feature' as const,
            geometry: { type: 'LineString' as const, coordinates },
            properties: {},
          },
        ]
      : [],
  };
}

function paceFeatureLines(
  paceSegments: MapRouteProps['paceSegments']
): GeoJSON.FeatureCollection<GeoJSON.LineString> | null {
  if (!paceSegments || paceSegments.length === 0) return null;
  return {
    type: 'FeatureCollection' as const,
    features: paceSegments.map((segment) => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: segment.coordinates },
      properties: { color: segment.color },
    })),
  };
}

function splitFeaturePoints(
  splitMarkers: readonly SplitMarker[]
): GeoJSON.FeatureCollection<GeoJSON.Point> | null {
  if (splitMarkers.length === 0) return null;
  return {
    type: 'FeatureCollection' as const,
    features: splitMarkers.map((marker) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: marker.coordinate },
      properties: { label: marker.label },
    })),
  };
}

function heatmapFeaturePoints(
  heatmapPoints: LngLatPair[],
  heatmapVisible: boolean
): GeoJSON.FeatureCollection<GeoJSON.Point> | null {
  if (!heatmapVisible || heatmapPoints.length === 0) return null;
  return {
    type: 'FeatureCollection',
    features: heatmapPoints.map(([lng, lat]) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {},
    })),
  };
}

const PUCK_DOT_RADIUS = 7;
const PUCK_CASING_RADIUS = 10;
/** The accuracy circle's radius is carried in pixels at zoom 0; every zoom level doubles it. */
const PUCK_ACCURACY_RADIUS = [
  'interpolate',
  ['exponential', 2],
  ['zoom'],
  0,
  ['get', 'accuracyPx'],
  22,
  ['*', ['get', 'accuracyPx'], 4194304],
] as never;

const MapLibreRouteInternal = React.memo(function MapLibreRouteInternal({
  coordinates,
  territoryPolygons = [],
  territoryIds = [],
  territoryColor = Brand.primary,
  territoryOpacity = 0.25,
  markers = [],
  followUser,
  onFollowChange,
  onMapPress,
  onMapLongPress,
  initialCenter = [73.851074, 18.524209],
  initialZoom = 15,
  initialBounds,
  style,
  showUserLocation = false,
  dark = false,
  poi = true,
  bikeLanes = false,
  cameraRef,
  activityRoutes = [],
  compassTopOffset = 150,
  othersTerritories = [],
  othersTerritoryColor = OTHERS_TERRITORY_COLOR,
  othersTerritoryOpacity = 0.12,
  heatmapPoints = [],
  heatmapVisible = true,
  heatmapRamp,
  onTerritoryPress,
  onZoomChanged,
  onCameraMove,
  zoomRange,
  position,
  splitMarkers = [],
  paceSegments,
  onMapReady,
}: MapRouteProps) {
  // A live route grows by one point per fix; only a longer line or a new last point is new geometry.
  const routeLength = coordinates?.length ?? 0;
  const lastPoint = coordinates?.[routeLength - 1];
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on length and last point, not on the array identity a fix replaces
  const routeGeoJSON = useMemo(
    () => routeFeatureLine(coordinates),
    [routeLength, lastPoint?.[0], lastPoint?.[1]]
  );

  const paceGeoJSON = useMemo(() => paceFeatureLines(paceSegments), [paceSegments]);

  const splitGeoJSON = useMemo(() => splitFeaturePoints(splitMarkers), [splitMarkers]);

  const puckGeoJSON = useMemo(
    () => (position === undefined ? null : puckFeatureCollection(position)),
    [position]
  );

  const territoryGeoJSON = territoryFeatureCollection(
    territoryPolygons.map((ring, i) => ({
      id: territoryIds[i] ?? `local-${i}`,
      ring,
    }))
  );

  const othersTerritoryGeoJSON = territoryFeatureCollection(othersTerritories);

  const routesGeoJSON = routeFeatureCollection(activityRoutes);

  const heatmapGeoJSON = heatmapFeaturePoints(heatmapPoints, heatmapVisible);

  const handleTerritoryPress = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    if (!onTerritoryPress) return;
    // Native press events arrive with `features` at the event's top level in
    // some platform builds and under `nativeEvent` in others — read both.
    const features = event.nativeEvent?.features ?? topLevelFeatures(event);
    const territoryId = features?.[0]?.properties?.territoryId;
    if (typeof territoryId === 'string' && !territoryId.startsWith('local-')) {
      onTerritoryPress(territoryId);
    }
  };

  const cameraCenter =
    coordinates && coordinates.length > 0
      ? coordinates[Math.floor(coordinates.length / 2)]
      : initialCenter;

  // With no connection on a first visit the style cannot load, and nothing is drawn on a map
  // without one. A plain background keeps the route, territory and pins showing.
  const [styleFailed, setStyleFailed] = useState(false);
  const onStyleFailed = () => setStyleFailed(true);
  const resolvedMapStyle = styleFailed
    ? offlineMapStyle(dark)
    : outdoorStyleFor(dark, { poi, bikeLanes });

  return (
    <MapLibreMap
      style={[styles.map, style]}
      mapStyle={resolvedMapStyle}
      compassPosition={{ top: compassTopOffset, right: Spacing.three }}
      onDidFinishLoadingMap={onMapReady}
      onDidFailLoadingMap={onStyleFailed}
      onPress={onMapPress ? () => onMapPress() : undefined}
      onLongPress={
        onMapLongPress
          ? (e) => onMapLongPress([e.nativeEvent.lngLat[0], e.nativeEvent.lngLat[1]])
          : undefined
      }
      onRegionIsChanging={
        onCameraMove
          ? (e) => {
              if (e.nativeEvent?.userInteraction) onCameraMove(cameraMoveOf(e.nativeEvent, false));
            }
          : undefined
      }
      onRegionDidChange={
        onZoomChanged || onCameraMove
          ? (e) => {
              onZoomChanged?.(e.nativeEvent?.zoom ?? initialZoom);
              if (e.nativeEvent) onCameraMove?.(cameraMoveOf(e.nativeEvent, true));
            }
          : undefined
      }
    >
      <Camera
        ref={cameraRef}
        initialViewState={
          initialBounds
            ? { bounds: initialBounds.bounds, padding: initialBounds.padding }
            : { center: cameraCenter, zoom: initialZoom }
        }
        minZoom={zoomRange?.min}
        maxZoom={zoomRange?.max}
        trackUserLocation={followUser}
        onTrackUserLocationChange={
          onFollowChange
            ? (e) => onFollowChange(e.nativeEvent.trackUserLocation != null)
            : undefined
        }
      />

      {showUserLocation && NativeUserLocation && <NativeUserLocation mode={followUser} />}

      {heatmapGeoJSON && (
        <GeoJSONSource id="activity-heatmap" data={heatmapGeoJSON}>
          <Layer
            id="activity-heat"
            type="heatmap"
            source="activity-heatmap"
            paint={{
              'heatmap-weight': 1,
              'heatmap-intensity': 0.35,
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                ...(heatmapRamp ?? HEAT_RAMP).flat(),
              ],
              'heatmap-radius': 20,
              'heatmap-opacity': 0.55,
            }}
          />
        </GeoJSONSource>
      )}

      {othersTerritoryGeoJSON && (
        <GeoJSONSource
          id="others-territory"
          data={othersTerritoryGeoJSON}
          onPress={handleTerritoryPress}
        >
          <Layer
            id="others-territory-fill"
            source="others-territory"
            type="fill"
            paint={{
              'fill-color': othersTerritoryColor,
              'fill-opacity': othersTerritoryOpacity,
            }}
          />
          <Layer
            id="others-territory-border"
            source="others-territory"
            type="line"
            paint={{
              'line-color': othersTerritoryColor,
              'line-width': 1,
              'line-opacity': 0.5,
            }}
          />
        </GeoJSONSource>
      )}

      {territoryGeoJSON && (
        <GeoJSONSource id="territory" data={territoryGeoJSON} onPress={handleTerritoryPress}>
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

      <GeoJSONSource id="route" data={routeGeoJSON}>
        {/* An outline lifts the line off busy ground, the way a trail reads on a topo map. */}
        <Layer
          id="route-casing"
          type="line"
          source="route"
          layout={{
            'line-cap': 'round',
            'line-join': 'round',
          }}
          paint={{
            'line-color': dark ? ROUTE_CASING_COLOR_DARK : Palette.white,
            'line-width': ROUTE_CASING_WIDTH,
            'line-opacity': dark ? ROUTE_CASING_OPACITY_DARK : ROUTE_CASING_OPACITY_LIGHT,
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
            'line-width': ROUTE_LINE_WIDTH,
            'line-opacity': paceGeoJSON ? 0 : 1,
          }}
        />
        {/* Small arrowheads along the line, so the direction of the route reads at a glance. */}
        <Layer
          id="route-arrows"
          type="symbol"
          source="route"
          layout={{
            'symbol-placement': 'line',
            'symbol-spacing': 80,
            'text-field': '›',
            // Without a font MapLibre asks for its own default, which the tile host does not serve (404), so the chevrons never drew.
            'text-font': ['Noto Sans Regular'],
            'text-size': 22,
            'text-keep-upright': false,
            'text-rotation-alignment': 'map',
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          }}
          paint={{
            'text-color': Palette.white,
            'text-halo-color': Brand.primary,
            'text-halo-width': 1.2,
          }}
        />
      </GeoJSONSource>

      {paceGeoJSON && (
        <GeoJSONSource id="route-pace" data={paceGeoJSON}>
          <Layer
            id="route-pace-line"
            type="line"
            source="route-pace"
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': ROUTE_LINE_WIDTH,
            }}
          />
        </GeoJSONSource>
      )}

      {splitGeoJSON && (
        <GeoJSONSource id="split-markers" data={splitGeoJSON}>
          <Layer
            id="split-markers-dot"
            type="circle"
            source="split-markers"
            minzoom={SPLIT_MARKER_MIN_ZOOM}
            paint={{
              'circle-radius': SPLIT_MARKER_RADIUS,
              'circle-color': Palette.white,
              'circle-stroke-color': Palette.neutral.n1,
              'circle-stroke-width': 1.5,
            }}
          />
          {/* The offline fallback style has no glyphs, so the numbers can't be drawn there. */}
          <Layer
            id="split-markers-label"
            type="symbol"
            source="split-markers"
            minzoom={SPLIT_MARKER_MIN_ZOOM}
            layout={{
              visibility: styleFailed ? 'none' : 'visible',
              'text-field': ['get', 'label'],
              'text-font': ['Noto Sans Bold'],
              'text-size': SPLIT_LABEL_SIZE,
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            }}
            paint={{ 'text-color': Palette.neutral.n1 }}
          />
        </GeoJSONSource>
      )}

      {routesGeoJSON && (
        <GeoJSONSource id="activity-routes" data={routesGeoJSON}>
          <Layer
            id="activity-routes-glow"
            type="line"
            source="activity-routes"
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 6,
              'line-opacity': 0.18,
            }}
          />
          <Layer
            id="activity-routes-line"
            type="line"
            source="activity-routes"
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 2.5,
            }}
          />
        </GeoJSONSource>
      )}

      {puckGeoJSON && (
        <GeoJSONSource id="position-puck" data={puckGeoJSON}>
          <Layer
            id="position-puck-accuracy"
            type="circle"
            source="position-puck"
            paint={{
              'circle-radius': PUCK_ACCURACY_RADIUS,
              'circle-color': Brand.primary,
              'circle-opacity': 0.14,
              'circle-stroke-color': Brand.primary,
              'circle-stroke-width': 1,
              'circle-stroke-opacity': 0.35,
            }}
          />
          {/* The offline fallback style has no glyphs, so the arrow can't be drawn there. */}
          <Layer
            id="position-puck-heading"
            type="symbol"
            source="position-puck"
            filter={['has', 'heading']}
            layout={{
              visibility: styleFailed ? 'none' : 'visible',
              'text-field': '▲',
              'text-font': ['Noto Sans Bold'],
              'text-size': 16,
              'text-rotate': ['get', 'heading'],
              'text-rotation-alignment': 'map',
              'text-offset': [0, -1.5],
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            }}
            paint={{
              'text-color': Brand.primary,
              'text-halo-color': Palette.white,
              'text-halo-width': 1.5,
            }}
          />
          <Layer
            id="position-puck-casing"
            type="circle"
            source="position-puck"
            paint={{ 'circle-radius': PUCK_CASING_RADIUS, 'circle-color': Palette.white }}
          />
          <Layer
            id="position-puck-dot"
            type="circle"
            source="position-puck"
            paint={{ 'circle-radius': PUCK_DOT_RADIUS, 'circle-color': Brand.primary }}
          />
        </GeoJSONSource>
      )}

      {markers.map((marker) => (
        <Marker
          key={marker.id}
          lngLat={[marker.coordinate[0], marker.coordinate[1]]}
          anchor="center"
        >
          <MapPin color={marker.color} icon={marker.icon} />
        </Marker>
      ))}
    </MapLibreMap>
  );
});

export const MapRoute = React.memo(function MapRoute(props: MapRouteProps) {
  return (
    <MapErrorBoundary fallback={<MapRouteFallback {...props} />}>
      <MapLibreRouteInternal {...props} />
    </MapErrorBoundary>
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
