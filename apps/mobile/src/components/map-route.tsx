import {
  Atmosphere,
  Camera,
  CircleLayer,
  FillLayer,
  HeatmapLayer,
  LineLayer,
  LocationPuck,
  type MapState,
  MapView,
  MarkerView,
  PointAnnotation,
  RasterDemSource,
  ShapeSource,
  SymbolLayer,
  Terrain,
  UserTrackingMode,
} from '@rnmapbox/maps';
import React, { useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import {
  type CameraRef,
  createMapCamera,
  type MapCamera,
  type MapViewLike,
  toMapboxPadding,
} from '@/components/map-camera';
import { MapErrorBoundary, MapPin, MapRouteFallback } from '@/components/map-route-fallback';
import { type HeatmapColor, heatRampFor } from '@/constants/heatmapColors';
import {
  type BaseMapType,
  BIKE_LANE_COLOR,
  BIKE_LANE_FILTER,
  BIKE_LANE_SOURCE,
  hasStreetData,
  isDarkBase,
  MAPBOX_FONT,
  mapboxStyleUrl,
  POI_LABEL_LAYER,
  TERRAIN_DEM,
} from '@/constants/mapboxStyle';
import { offlineMapStyle } from '@/constants/mapStyle';
import { Palette } from '@/constants/palette';
import { Brand, OTHERS_TERRITORY_COLOR, Spacing } from '@/constants/theme';
import { ensureMapbox } from '@/services/mapbox';
import type { Ring } from '@/types';
import type { HeatCell } from '@/utils/heatmap';
import { type PuckPosition, puckFeatureCollection } from '@/utils/locationPuck';
import {
  type LngLatPair,
  routeFeatureCollection,
  type TerritoryFeatureInput,
  territoryFeatureCollection,
} from '@/utils/mapData';
import { type MapPoi, poiFromFeature } from '@/utils/poi';
import type { Bounds } from '@/utils/routeBounds';
import type { SplitMarker } from '@/utils/splitMarkers';

export interface MapMarker {
  id: string;
  coordinate: [number, number];
  color: string;
  icon?: string;
  label?: string;
  /** Can be dragged to a new spot; `onMarkerDragEnd` hears where it was dropped. */
  draggable?: boolean;
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
  /** A tap on empty map, at [lng, lat] (a tap on a territory also arrives here). */
  onMapPress?: (lngLat: [number, number]) => void;
  /** A draggable marker was dropped at [lng, lat]. */
  onMarkerDragEnd?: (id: string, lngLat: [number, number]) => void;
  /** A draggable marker was tapped. */
  onMarkerPress?: (id: string) => void;
  /** A tap on a labelled place of the base map (café, toilets, viewpoint…); takes the tap from `onMapPress`. */
  onPoiPress?: (poi: MapPoi) => void;
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
  /** Streets and trails, aerial imagery, or imagery with streets on top. */
  mapType?: BaseMapType;
  /** Draw hills in 3D; the camera's tilt is up to the caller. */
  terrain3d?: boolean;
  /** Label parks and other places on the base map. */
  poi?: boolean;
  /** Draw cycle paths on the base map. */
  bikeLanes?: boolean;
  cameraRef?: React.RefObject<MapCamera | null>;
  activityRoutes?: ActivityRoute[];
  /** Top offset (px) of the native compass; pass the bottom edge of any floating controls over the map. */
  compassTopOffset?: number;
  /** Other athletes' territory footprints (bounds-derived rectangles), each tagged with its territory id. */
  othersTerritories?: TerritoryFeatureInput[];
  othersTerritoryColor?: string;
  othersTerritoryOpacity?: number;
  /** Point cloud for the activity-density heatmap layer. */
  heatmapPoints?: ReadonlyArray<LngLatPair | HeatCell>;
  /** Colour scheme of the heatmap. */
  heatmapColor?: HeatmapColor;
  heatmapVisible?: boolean;
  /** Colours of the heatmap, cool to hot; the classic ramp when left out. */
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
  /** A planned route to follow, drawn under the live track. */
  guideLine?: readonly LngLatPair[];
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

function cameraMoveOf(state: MapState, userInteraction: boolean, settled: boolean): CameraMove {
  const { center, zoom, heading } = state.properties;
  return {
    center: [center[0] as number, center[1] as number],
    zoom,
    bearing: heading,
    userInteraction,
    settled,
  };
}

type ShapePressEvent = Parameters<
  NonNullable<React.ComponentProps<typeof ShapeSource>['onPress']>
>[0];

const TRACKING_MODE = {
  default: UserTrackingMode.Follow,
  heading: UserTrackingMode.FollowWithHeading,
  course: UserTrackingMode.FollowWithCourse,
} as const;

/** A planned route is blue, so the orange live track reads on top of it. */
const GUIDE_COLOR = Palette.blue.b3;

/** How far from a label (in points) a finger can land and still pick it. */
const POI_TAP_SLOP = 14;

/** Bike lanes widen with zoom like the roads around them. */
const BIKE_LANE_WIDTH = ['interpolate', ['linear'], ['zoom'], 12, 1.5, 16, 3.5, 18, 5] as never;

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
  heatmapPoints: ReadonlyArray<LngLatPair | HeatCell>,
  heatmapVisible: boolean
): { shape: GeoJSON.FeatureCollection<GeoJSON.Point>; maxWeight: number } | null {
  if (!heatmapVisible || heatmapPoints.length === 0) return null;
  let maxWeight = 1;
  const features = heatmapPoints.map((point) => {
    const w = point[2] ?? 1;
    if (w > maxWeight) maxWeight = w;
    return {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point[0], point[1]] },
      properties: { w },
    };
  });
  return { shape: { type: 'FeatureCollection', features }, maxWeight };
}

/** The glow widens and brightens as you zoom in, so streets stay readable at every scale. */
const HEAT_RADIUS = ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 12, 17, 26] as never;
const HEAT_INTENSITY = ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 1.2, 18, 1.8] as never;

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

const MapboxRouteInternal = React.memo(function MapboxRouteInternal({
  coordinates,
  territoryPolygons = [],
  territoryIds = [],
  territoryColor = Brand.primary,
  territoryOpacity = 0.25,
  markers = [],
  followUser,
  onFollowChange,
  onMapPress,
  onPoiPress,
  onMarkerDragEnd,
  onMarkerPress,
  onMapLongPress,
  initialCenter = [73.851074, 18.524209],
  initialZoom = 15,
  initialBounds,
  style,
  showUserLocation = false,
  dark = false,
  mapType = 'standard',
  terrain3d = false,
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
  heatmapColor = 'classic',
  onTerritoryPress,
  onZoomChanged,
  onCameraMove,
  zoomRange,
  position,
  splitMarkers = [],
  paceSegments,
  guideLine,
  onMapReady,
}: MapRouteProps) {
  const nativeCameraRef = useRef<CameraRef>(null);
  const mapViewRef = useRef<MapView>(null);
  // A tapped annotation stays "selected" natively and would not report a second tap: rebuild
  // the annotations after each one.
  const [markerTaps, setMarkerTaps] = useState(0);
  useImperativeHandle(
    cameraRef,
    () => createMapCamera(nativeCameraRef, mapViewRef as React.RefObject<MapViewLike | null>),
    []
  );

  // A live route grows by one point per fix; only a longer line or a new last point is new geometry.
  const routeLength = coordinates?.length ?? 0;
  const lastPoint = coordinates?.[routeLength - 1];
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on length and last point, not on the array identity a fix replaces
  const routeGeoJSON = useMemo(
    () => routeFeatureLine(coordinates),
    [routeLength, lastPoint?.[0], lastPoint?.[1]]
  );

  const paceGeoJSON = useMemo(() => paceFeatureLines(paceSegments), [paceSegments]);
  const guideGeoJSON = useMemo(
    () => (guideLine && guideLine.length > 1 ? routeFeatureLine([...guideLine]) : null),
    [guideLine]
  );

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

  const handleTerritoryPress = (event: ShapePressEvent) => {
    if (!onTerritoryPress) return;
    const territoryId = event.features[0]?.properties?.territoryId;
    if (typeof territoryId === 'string' && !territoryId.startsWith('local-')) {
      onTerritoryPress(territoryId);
    }
  };

  const cameraCenter =
    coordinates && coordinates.length > 0
      ? coordinates[Math.floor(coordinates.length / 2)]
      : initialCenter;

  // Set while a finger moves the map, so the move it settles into is reported as the athlete's.
  const gestureRef = useRef(false);

  // With no connection on a first visit (or no token) the style cannot load, and nothing is drawn
  // on a map without one. A plain background keeps the route, territory and pins showing.
  const [styleFailed, setStyleFailed] = useState(false);
  const onStyleFailed = () => setStyleFailed(true);
  const offlineStyleJSON = useMemo(() => JSON.stringify(offlineMapStyle(dark)), [dark]);
  const textVisibility = styleFailed ? 'none' : 'visible';
  const streets = !styleFailed && hasStreetData(mapType);
  const darkBase = isDarkBase(dark, mapType);

  /** A tap that lands on a place label opens it; anything else is a plain map tap. */
  const handlePress = async (
    screen: { screenPointX: number; screenPointY: number },
    lngLat: [number, number]
  ) => {
    if (onPoiPress && streets && poi) {
      const { screenPointX: x, screenPointY: y } = screen;
      try {
        const hits = await mapViewRef.current?.queryRenderedFeaturesInRect(
          [y - POI_TAP_SLOP, x - POI_TAP_SLOP, y + POI_TAP_SLOP, x + POI_TAP_SLOP],
          [],
          [POI_LABEL_LAYER]
        );
        const place = hits?.features.map(poiFromFeature).find((p) => p !== null);
        if (place) {
          onPoiPress(place);
          return;
        }
      } catch {
        // A failed query is just a tap on the map.
      }
    }
    onMapPress?.(lngLat);
  };

  return (
    <MapView
      ref={mapViewRef}
      style={[styles.map, style]}
      {...(styleFailed
        ? { styleJSON: offlineStyleJSON }
        : { styleURL: mapboxStyleUrl(dark, mapType) })}
      // Android: a GLSurfaceView drew over the app's animated sheets (the Map tab's sheet vanished);
      // a TextureView composites with the views around it.
      surfaceView={false}
      compassEnabled
      compassPosition={{ top: compassTopOffset, right: Spacing.three }}
      scaleBarEnabled={false}
      onDidFinishLoadingMap={onMapReady}
      onDidFailLoadingMap={onStyleFailed}
      onPress={
        onMapPress || onPoiPress
          ? (feature) => {
              const [lng, lat] = feature.geometry.coordinates;
              void handlePress(feature.properties, [lng as number, lat as number]);
            }
          : undefined
      }
      onLongPress={
        onMapLongPress
          ? (feature) => {
              const [lng, lat] = feature.geometry.coordinates;
              onMapLongPress([lng as number, lat as number]);
            }
          : undefined
      }
      onCameraChanged={
        onCameraMove
          ? (state) => {
              if (!state.gestures.isGestureActive) return;
              gestureRef.current = true;
              onCameraMove(cameraMoveOf(state, true, false));
            }
          : undefined
      }
      onMapIdle={
        onZoomChanged || onCameraMove
          ? (state) => {
              const byUser = gestureRef.current;
              gestureRef.current = false;
              onZoomChanged?.(state.properties.zoom ?? initialZoom);
              onCameraMove?.(cameraMoveOf(state, byUser, true));
            }
          : undefined
      }
    >
      <Camera
        ref={nativeCameraRef}
        defaultSettings={
          initialBounds
            ? {
                bounds: {
                  ne: [initialBounds.bounds[2], initialBounds.bounds[3]],
                  sw: [initialBounds.bounds[0], initialBounds.bounds[1]],
                },
                padding: toMapboxPadding(initialBounds.padding),
              }
            : { centerCoordinate: cameraCenter, zoomLevel: initialZoom }
        }
        minZoomLevel={zoomRange?.min}
        maxZoomLevel={zoomRange?.max}
        followUserLocation={followUser !== undefined}
        followUserMode={followUser ? TRACKING_MODE[followUser] : undefined}
        onUserTrackingModeChange={
          onFollowChange
            ? (event) => onFollowChange(event.nativeEvent.payload.followUserLocation)
            : undefined
        }
      />

      {showUserLocation && (
        <LocationPuck
          puckBearingEnabled={followUser === 'heading' || followUser === 'course'}
          puckBearing={followUser === 'course' ? 'course' : 'heading'}
        />
      )}

      {terrain3d && !styleFailed && (
        <RasterDemSource
          id={TERRAIN_DEM.id}
          url={TERRAIN_DEM.url}
          tileSize={TERRAIN_DEM.tileSize}
          maxZoomLevel={TERRAIN_DEM.maxZoom}
        >
          <Terrain style={{ exaggeration: TERRAIN_DEM.exaggeration }} />
          <Atmosphere
            style={{
              color: darkBase ? '#1b2330' : '#d8e6f3',
              highColor: darkBase ? '#0b0f17' : '#8fb4dc',
              horizonBlend: 0.08,
              spaceColor: darkBase ? '#05070b' : '#7aa7d6',
              starIntensity: darkBase ? 0.2 : 0,
            }}
          />
        </RasterDemSource>
      )}

      {streets && (
        <SymbolLayer
          id={POI_LABEL_LAYER}
          existing
          style={{ visibility: poi ? 'visible' : 'none' }}
        />
      )}

      {bikeLanes && streets && (
        <LineLayer
          id="bike-lanes"
          sourceID={BIKE_LANE_SOURCE.sourceID}
          sourceLayerID={BIKE_LANE_SOURCE.sourceLayerID}
          filter={BIKE_LANE_FILTER as never}
          style={{
            lineColor: BIKE_LANE_COLOR,
            lineWidth: BIKE_LANE_WIDTH,
            lineOpacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}

      {heatmapGeoJSON && (
        <ShapeSource id="activity-heatmap" shape={heatmapGeoJSON.shape}>
          <HeatmapLayer
            id="activity-heat"
            style={{
              // The busiest spot weighs 1; a spot used once still glows faintly.
              heatmapWeight: [
                'interpolate',
                ['linear'],
                ['get', 'w'],
                1,
                0.3,
                Math.max(2, heatmapGeoJSON.maxWeight),
                1,
              ] as never,
              heatmapIntensity: HEAT_INTENSITY,
              heatmapColor: [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                ...heatRampFor(heatmapColor).flat(),
              ] as never,
              heatmapRadius: HEAT_RADIUS,
              heatmapOpacity: 0.85,
            }}
          />
        </ShapeSource>
      )}

      {othersTerritoryGeoJSON && (
        <ShapeSource
          id="others-territory"
          shape={othersTerritoryGeoJSON}
          onPress={handleTerritoryPress}
        >
          <FillLayer
            id="others-territory-fill"
            style={{ fillColor: othersTerritoryColor, fillOpacity: othersTerritoryOpacity }}
          />
          <LineLayer
            id="others-territory-border"
            style={{ lineColor: othersTerritoryColor, lineWidth: 1, lineOpacity: 0.5 }}
          />
        </ShapeSource>
      )}

      {territoryGeoJSON && (
        <ShapeSource id="territory" shape={territoryGeoJSON} onPress={handleTerritoryPress}>
          <FillLayer
            id="territory-fill"
            style={{ fillColor: territoryColor, fillOpacity: territoryOpacity }}
          />
          <LineLayer
            id="territory-border"
            style={{ lineColor: territoryColor, lineWidth: 2, lineOpacity: 0.8 }}
          />
        </ShapeSource>
      )}

      {guideGeoJSON && (
        <ShapeSource id="guide-route" shape={guideGeoJSON}>
          <LineLayer
            id="guide-route-casing"
            style={{
              lineCap: 'round',
              lineJoin: 'round',
              lineColor: Palette.white,
              lineWidth: ROUTE_CASING_WIDTH,
              lineOpacity: 0.85,
            }}
          />
          <LineLayer
            id="guide-route-line"
            style={{
              lineCap: 'round',
              lineJoin: 'round',
              lineColor: GUIDE_COLOR,
              lineWidth: ROUTE_LINE_WIDTH,
              lineOpacity: 0.9,
            }}
          />
        </ShapeSource>
      )}

      <ShapeSource id="route" shape={routeGeoJSON}>
        {/* An outline lifts the line off busy ground, the way a trail reads on a topo map. */}
        <LineLayer
          id="route-casing"
          style={{
            lineCap: 'round',
            lineJoin: 'round',
            lineColor: darkBase && mapType === 'standard' ? ROUTE_CASING_COLOR_DARK : Palette.white,
            lineWidth: ROUTE_CASING_WIDTH,
            lineOpacity: dark ? ROUTE_CASING_OPACITY_DARK : ROUTE_CASING_OPACITY_LIGHT,
          }}
        />
        <LineLayer
          id="route-line"
          style={{
            lineCap: 'round',
            lineJoin: 'round',
            lineColor: Brand.primary,
            lineWidth: ROUTE_LINE_WIDTH,
            lineOpacity: paceGeoJSON ? 0 : 1,
          }}
        />
        {/* Small arrowheads along the line, so the direction of the route reads at a glance. */}
        <SymbolLayer
          id="route-arrows"
          style={{
            visibility: textVisibility,
            symbolPlacement: 'line',
            symbolSpacing: 80,
            textField: '›',
            textFont: MAPBOX_FONT.regular,
            textSize: 22,
            textKeepUpright: false,
            textRotationAlignment: 'map',
            textAllowOverlap: true,
            textIgnorePlacement: true,
            textColor: Palette.white,
            textHaloColor: Brand.primary,
            textHaloWidth: 1.2,
          }}
        />
      </ShapeSource>

      {paceGeoJSON && (
        <ShapeSource id="route-pace" shape={paceGeoJSON}>
          <LineLayer
            id="route-pace-line"
            style={{
              lineCap: 'round',
              lineJoin: 'round',
              lineColor: ['get', 'color'],
              lineWidth: ROUTE_LINE_WIDTH,
            }}
          />
        </ShapeSource>
      )}

      {splitGeoJSON && (
        <ShapeSource id="split-markers" shape={splitGeoJSON}>
          <CircleLayer
            id="split-markers-dot"
            minZoomLevel={SPLIT_MARKER_MIN_ZOOM}
            style={{
              circleRadius: SPLIT_MARKER_RADIUS,
              circleColor: Palette.white,
              circleStrokeColor: Palette.neutral.n1,
              circleStrokeWidth: 1.5,
            }}
          />
          {/* The offline fallback style has no glyphs, so the numbers can't be drawn there. */}
          <SymbolLayer
            id="split-markers-label"
            minZoomLevel={SPLIT_MARKER_MIN_ZOOM}
            style={{
              visibility: textVisibility,
              textField: ['get', 'label'],
              textFont: MAPBOX_FONT.bold,
              textSize: SPLIT_LABEL_SIZE,
              textAllowOverlap: true,
              textIgnorePlacement: true,
              textColor: Palette.neutral.n1,
            }}
          />
        </ShapeSource>
      )}

      {routesGeoJSON && (
        <ShapeSource id="activity-routes" shape={routesGeoJSON}>
          <LineLayer
            id="activity-routes-glow"
            style={{
              lineCap: 'round',
              lineJoin: 'round',
              lineColor: ['get', 'color'],
              lineWidth: 6,
              lineOpacity: 0.18,
            }}
          />
          <LineLayer
            id="activity-routes-line"
            style={{
              lineCap: 'round',
              lineJoin: 'round',
              lineColor: ['get', 'color'],
              lineWidth: 2.5,
            }}
          />
        </ShapeSource>
      )}

      {puckGeoJSON && (
        <ShapeSource id="position-puck" shape={puckGeoJSON}>
          <CircleLayer
            id="position-puck-accuracy"
            style={{
              circleRadius: PUCK_ACCURACY_RADIUS,
              circleColor: Brand.primary,
              circleOpacity: 0.14,
              circleStrokeColor: Brand.primary,
              circleStrokeWidth: 1,
              circleStrokeOpacity: 0.35,
            }}
          />
          {/* The offline fallback style has no glyphs, so the arrow can't be drawn there. */}
          <SymbolLayer
            id="position-puck-heading"
            filter={['has', 'heading']}
            style={{
              visibility: textVisibility,
              textField: '▲',
              textFont: MAPBOX_FONT.bold,
              textSize: 16,
              textRotate: ['get', 'heading'],
              textRotationAlignment: 'map',
              textOffset: [0, -1.5],
              textAllowOverlap: true,
              textIgnorePlacement: true,
              textColor: Brand.primary,
              textHaloColor: Palette.white,
              textHaloWidth: 1.5,
            }}
          />
          <CircleLayer
            id="position-puck-casing"
            style={{ circleRadius: PUCK_CASING_RADIUS, circleColor: Palette.white }}
          />
          <CircleLayer
            id="position-puck-dot"
            style={{ circleRadius: PUCK_DOT_RADIUS, circleColor: Brand.primary }}
          />
        </ShapeSource>
      )}

      {markers.map((marker) =>
        marker.draggable ? (
          <PointAnnotation
            // Android draws an annotation's view once, as a picture: a new look needs a new annotation.
            key={`${marker.id}-${marker.icon ?? ''}-${marker.color}-${markerTaps}`}
            id={marker.id}
            coordinate={[marker.coordinate[0], marker.coordinate[1]]}
            anchor={{ x: 0.5, y: 0.5 }}
            draggable
            onSelected={() => {
              setMarkerTaps((n) => n + 1);
              onMarkerPress?.(marker.id);
            }}
            onDragEnd={(feature) => {
              const [lng, lat] = feature.geometry.coordinates;
              onMarkerDragEnd?.(marker.id, [lng as number, lat as number]);
            }}
          >
            <MapPin color={marker.color} icon={marker.icon} />
          </PointAnnotation>
        ) : (
          <MarkerView
            key={marker.id}
            coordinate={[marker.coordinate[0], marker.coordinate[1]]}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
          >
            <MapPin color={marker.color} icon={marker.icon} />
          </MarkerView>
        )
      )}
    </MapView>
  );
});

export const MapRoute = React.memo(function MapRoute(props: MapRouteProps) {
  // A build without a token can't load any Mapbox style; draw the route without a base map.
  if (!ensureMapbox()) return <MapRouteFallback {...props} />;
  return (
    <MapErrorBoundary fallback={<MapRouteFallback {...props} />}>
      <MapboxRouteInternal {...props} />
    </MapErrorBoundary>
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
