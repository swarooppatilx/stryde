import { StaticMapImageManager } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { MAP_STYLES } from '@/constants/config';
import { useTheme } from '@/hooks/use-theme';
import type { Ring } from '@/types';
import { parsePolyline } from '@/utils/format';

interface RouteThumbnailProps {
  polyline: string;
  territory?: Ring | null;
  height?: number;
  fallback?: React.ReactNode;
}

const IMG_W = 600;
const IMG_H = 240;

export function RouteThumbnail({
  polyline,
  territory,
  height = 120,
  fallback,
}: RouteThumbnailProps) {
  const theme = useTheme();
  const points = useMemo(() => parsePolyline(polyline), [polyline]);

  const shapes = useMemo(() => {
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
    const bMinLng = minLng - padLng;
    const bMaxLng = maxLng + padLng;
    const bMinLat = minLat - padLat;
    const bMaxLat = maxLat + padLat;

    const lngSpan = bMaxLng - bMinLng;
    const latSpan = bMaxLat - bMinLat;

    const toX = (lng: number) => ((lng - bMinLng) / lngSpan) * IMG_W;
    const toY = (lat: number) => ((bMaxLat - lat) / latSpan) * IMG_H;

    const toPath = (pts: [number, number][]) =>
      pts
        .map(
          ([lng, lat], i) => `${i === 0 ? 'M' : 'L'}${toX(lng).toFixed(1)},${toY(lat).toFixed(1)}`
        )
        .join(' ');

    return {
      routePath: points.length > 1 ? toPath(points) : null,
      routeDot: points.length === 1 ? { cx: toX(points[0][0]), cy: toY(points[0][1]) } : null,
      start: points.length > 1 ? { cx: toX(points[0][0]), cy: toY(points[0][1]) } : null,
      end:
        points.length > 1
          ? { cx: toX(points[points.length - 1][0]), cy: toY(points[points.length - 1][1]) }
          : null,
      territoryPath: territory && territory.length > 2 ? toPath(territory) : null,
      bounds: [bMinLng, bMinLat, bMaxLng, bMaxLat] as [number, number, number, number],
    };
  }, [points, territory]);

  const [mapUri, setMapUri] = useState<string | null>(null);

  useEffect(() => {
    if (!shapes?.bounds) {
      setMapUri(null);
      return;
    }
    let cancelled = false;
    StaticMapImageManager.createImage({
      bounds: shapes.bounds,
      mapStyle: theme.isDark ? MAP_STYLES.darkMatter : MAP_STYLES.voyager,
      width: IMG_W,
      height: IMG_H,
      output: 'file',
      logo: false,
    })
      .then((uri) => {
        if (!cancelled) setMapUri(uri);
      })
      .catch(() => {
        if (!cancelled) setMapUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [shapes?.bounds, theme.isDark]);

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
      {hasMap && (
        <Image source={{ uri: mapUri! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
        {shapes.start && (
          <Circle
            cx={shapes.start.cx}
            cy={shapes.start.cy}
            r={6}
            fill={theme.brand.success}
            stroke="#fff"
            strokeWidth={2}
          />
        )}
        {shapes.end && (
          <Circle
            cx={shapes.end.cx}
            cy={shapes.end.cy}
            r={6}
            fill={theme.brand.primary}
            stroke="#fff"
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
