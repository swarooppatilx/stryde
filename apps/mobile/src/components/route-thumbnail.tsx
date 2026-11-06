import { StaticMapImageManager } from '@maplibre/maplibre-react-native';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { outdoorStyleFor } from '@/constants/outdoorMapStyle';
import { Palette } from '@/constants/palette';
import { useTheme } from '@/hooks/use-theme';
import type { Ring } from '@/types';
import { parsePolyline } from '@/utils/format';
import { type Arrow, routeArrows } from '@/utils/routeArrows';
import { fitBoundsToAspect } from '@/utils/thumbnailBounds';
import { createThumbnailCache, thumbnailKey } from '@/utils/thumbnailCache';

interface RouteThumbnailProps {
  polyline: string;
  territory?: Ring | null;
  height?: number;
  fallback?: React.ReactNode;
}

const IMG_W = 600;
const IMG_H = 240;
const ARROW_COUNT = 4;

/** Pictures already rendered this session, so a card scrolled away and back does not render again. */
const pictureCache = createThumbnailCache(60);

interface RouteShapes {
  routePath: string | null;
  routeDot: { cx: number; cy: number } | null;
  start: { cx: number; cy: number } | null;
  end: { cx: number; cy: number } | null;
  territoryPath: string | null;
  arrows: Arrow[];
  bounds: [number, number, number, number];
}

function routeShapes(
  points: [number, number][],
  territory: Ring | null | undefined
): RouteShapes | null {
  const all: [number, number][] = [...points, ...(territory ?? [])];
  if (all.length === 0) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of all) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  if (maxLng - minLng < 1e-7) {
    minLng -= 5e-4;
    maxLng += 5e-4;
  }
  if (maxLat - minLat < 1e-7) {
    minLat -= 5e-4;
    maxLat += 5e-4;
  }

  // Pad bounds 30% so the route isn't flush with the edges.
  const padLng = (maxLng - minLng) * 0.3;
  const padLat = (maxLat - minLat) * 0.3;
  // Then reshape to the picture's proportions in meters, so a loop is not stretched into an ellipse.
  const [bMinLng, bMinLat, bMaxLng, bMaxLat] = fitBoundsToAspect(
    [minLng - padLng, minLat - padLat, maxLng + padLng, maxLat + padLat],
    IMG_W / IMG_H
  );

  const lngSpan = bMaxLng - bMinLng;
  const latSpan = bMaxLat - bMinLat;

  const toX = (lng: number) => ((lng - bMinLng) / lngSpan) * IMG_W;
  const toY = (lat: number) => ((bMaxLat - lat) / latSpan) * IMG_H;

  const toPath = (pts: [number, number][]) =>
    pts
      .map(([lng, lat], i) => `${i === 0 ? 'M' : 'L'}${toX(lng).toFixed(1)},${toY(lat).toFixed(1)}`)
      .join(' ');

  const dot = (p: [number, number] | undefined) => (p ? { cx: toX(p[0]), cy: toY(p[1]) } : null);

  return {
    routePath: points.length > 1 ? toPath(points) : null,
    routeDot: points.length === 1 ? dot(points[0]) : null,
    start: points.length > 1 ? dot(points[0]) : null,
    end: points.length > 1 ? dot(points.at(-1)) : null,
    territoryPath: territory && territory.length > 2 ? toPath(territory) : null,
    arrows: routeArrows(
      points.map(([lng, lat]) => ({ x: toX(lng), y: toY(lat) })),
      ARROW_COUNT
    ),
    bounds: [bMinLng, bMinLat, bMaxLng, bMaxLat] as [number, number, number, number],
  };
}

export function RouteThumbnail({
  polyline,
  territory,
  height = 120,
  fallback,
}: RouteThumbnailProps) {
  const theme = useTheme();
  // Parsed once per route: `shapes.bounds` is an effect dependency, so a fresh array on every render
  // would restart the map picture each time the card re-rendered.
  const shapes = useMemo(
    () => routeShapes(parsePolyline(polyline), territory),
    [polyline, territory]
  );
  const key = useMemo(
    () => thumbnailKey(parsePolyline(polyline), territory, theme.isDark),
    [polyline, territory, theme.isDark]
  );

  const [mapUri, setMapUri] = useState<string | null>(() => pictureCache.get(key) ?? null);

  useEffect(() => {
    const cached = pictureCache.get(key);
    if (cached) {
      setMapUri(cached);
      return;
    }
    if (!shapes?.bounds) {
      setMapUri(null);
      return;
    }
    let cancelled = false;
    StaticMapImageManager.createImage({
      bounds: shapes.bounds,
      mapStyle: outdoorStyleFor(theme.isDark),
      width: IMG_W,
      height: IMG_H,
      output: 'file',
      logo: false,
    })
      .then((uri) => {
        pictureCache.set(key, uri);
        if (!cancelled) setMapUri(uri);
      })
      .catch(() => {
        if (!cancelled) setMapUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [key, shapes?.bounds, theme.isDark]);

  if (!shapes) {
    return (
      <View style={[styles.fallback, { backgroundColor: theme.background, height }]}>
        {fallback}
      </View>
    );
  }

  const hasMap = !!mapUri;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement, height }]}>
      {mapUri && (
        <Image source={{ uri: mapUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${IMG_W} ${IMG_H}`}
        style={StyleSheet.absoluteFill}
      >
        {!hasMap &&
          // Faint grid only when the static map image hasn't loaded yet.
          [0.2, 0.4, 0.6, 0.8].map((r) => (
            <Path
              key={`grid-${r}`}
              d={`M0,${IMG_H * r} L${IMG_W},${IMG_H * r}`}
              stroke={theme.textSecondary}
              strokeWidth={1}
              opacity={0.15}
            />
          ))}
        {!hasMap &&
          [0.25, 0.5, 0.75].map((r) => (
            <Path
              key={`grid-v-${r}`}
              d={`M${IMG_W * r},0 L${IMG_W * r},${IMG_H}`}
              stroke={theme.textSecondary}
              strokeWidth={1}
              opacity={0.15}
            />
          ))}
        {shapes.territoryPath && (
          <Path
            d={shapes.territoryPath}
            fill={theme.brand.primaryTint}
            stroke={theme.brand.success}
            strokeWidth={2}
          />
        )}
        {shapes.routePath && (
          <>
            <Path
              d={shapes.routePath}
              fill="none"
              stroke={theme.brand.primary}
              strokeWidth={10}
              strokeOpacity={0.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={shapes.routePath}
              fill="none"
              stroke={theme.brand.primary}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        {shapes.routeDot && (
          <Circle
            cx={shapes.routeDot.cx}
            cy={shapes.routeDot.cy}
            r={8}
            fill={theme.brand.primary}
          />
        )}
        {shapes.arrows.map((a) => (
          // A small white chevron on the route line; rotated so it points the way the route goes.
          <Path
            key={`arrow-${a.x.toFixed(0)}-${a.y.toFixed(0)}`}
            d="M-5,-5 L3,0 L-5,5"
            fill="none"
            stroke={Palette.white}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform={`translate(${a.x.toFixed(1)},${a.y.toFixed(1)}) rotate(${a.angle.toFixed(1)})`}
          />
        ))}
        {shapes.end && (
          // A ring, drawn first: on a loop the start sits inside it instead of being covered.
          <Circle
            cx={shapes.end.cx}
            cy={shapes.end.cy}
            r={9}
            fill={Palette.white}
            stroke={theme.brand.primary}
            strokeWidth={4}
          />
        )}
        {shapes.start && (
          <Circle
            cx={shapes.start.cx}
            cy={shapes.start.cy}
            r={6}
            fill={theme.brand.success}
            stroke={Palette.white}
            strokeWidth={2}
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden' },
  fallback: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
