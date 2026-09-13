import { forwardRef, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  Rect,
  Text as SvgText,
  TSpan,
} from 'react-native-svg';

import { Brand } from '@/constants/theme';
import type { Ring } from '@/types';
import { formatArea, formatDistance, formatDurationLong, formatPace } from '@/utils/format';

const WIDTH = 1080;
const STATS_HEIGHT = 220;
const LOGO_HEIGHT = 150;

interface ShareRouteImageProps {
  coordinates: [number, number][];
  territory?: Ring | null;
  territoryArea: number;
  distance: number;
  duration: number;
  /** Canvas height in px — 1080 for a square feed/share card, 1920 for a
   * full-bleed 9:16 Instagram Story. Defaults to a square. */
  height?: number;
}

export const ShareRouteImage = forwardRef<Svg, ShareRouteImageProps>(function ShareRouteImage(
  { coordinates, territory, territoryArea, distance, duration, height = WIDTH },
  ref
) {
  const HEIGHT = height;
  const ROUTE_TOP = STATS_HEIGHT;
  const ROUTE_BOTTOM = HEIGHT - LOGO_HEIGHT;
  const ROUTE_HEIGHT = ROUTE_BOTTOM - ROUTE_TOP;

  const shapes = useMemo(() => {
    const all: [number, number][] = [...coordinates, ...(territory ?? [])];
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

    const padLng = (maxLng - minLng) * 0.3;
    const padLat = (maxLat - minLat) * 0.3;
    const bMinLng = minLng - padLng;
    const bMaxLng = maxLng + padLng;
    const bMinLat = minLat - padLat;
    const bMaxLat = maxLat + padLat;

    const lngSpan = bMaxLng - bMinLng;
    const latSpan = bMaxLat - bMinLat;

    // A degree of longitude covers less ground away from the equator, so scale
    // it by cos(latitude), then letterbox into the route band — mapping each
    // axis independently stretched routes to the canvas aspect ratio.
    const lngScale = Math.max(Math.cos(((bMinLat + bMaxLat) / 2) * (Math.PI / 180)), 1e-6);
    const lngSpanEq = lngSpan * lngScale;
    const routeInsetX = 80;
    const fit = Math.min((WIDTH - routeInsetX * 2) / lngSpanEq, ROUTE_HEIGHT / latSpan);
    const offsetX = (WIDTH - lngSpanEq * fit) / 2;
    const offsetY = ROUTE_TOP + (ROUTE_HEIGHT - latSpan * fit) / 2;

    const toX = (lng: number) => offsetX + (lng - bMinLng) * lngScale * fit;
    const toY = (lat: number) => offsetY + (bMaxLat - lat) * fit;

    const toPath = (pts: [number, number][]) =>
      pts
        .map(
          ([lng, lat], i) => `${i === 0 ? 'M' : 'L'}${toX(lng).toFixed(1)},${toY(lat).toFixed(1)}`
        )
        .join(' ');

    return {
      routePath: coordinates.length > 1 ? toPath(coordinates) : null,
      routeDot:
        coordinates.length === 1
          ? { cx: toX(coordinates[0][0]), cy: toY(coordinates[0][1]) }
          : null,
      start:
        coordinates.length > 1 ? { cx: toX(coordinates[0][0]), cy: toY(coordinates[0][1]) } : null,
      end:
        coordinates.length > 1
          ? {
              cx: toX(coordinates[coordinates.length - 1][0]),
              cy: toY(coordinates[coordinates.length - 1][1]),
            }
          : null,
      territoryPath: territory && territory.length > 2 ? toPath(territory) : null,
    };
  }, [coordinates, territory, ROUTE_HEIGHT, ROUTE_TOP]);

  const colWidth = WIDTH / 3;

  return (
    <View style={[styles.container, { width: WIDTH, height: HEIGHT }]}>
      <Svg ref={ref} width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <ClipPath id="routeClip">
            <Rect x={0} y={ROUTE_TOP} width={WIDTH} height={ROUTE_HEIGHT} />
          </ClipPath>
        </Defs>

        {/* Top stats section */}
        <SvgText x={colWidth * 0.5} y={55} textAnchor="middle">
          <TSpan fontSize={24} fontWeight="600" fill={Brand.white} fillOpacity={0.5}>
            TIME
          </TSpan>
        </SvgText>
        <SvgText x={colWidth * 0.5} y={105} textAnchor="middle">
          <TSpan fontSize={42} fontWeight="700" fill={Brand.white}>
            {formatDurationLong(duration)}
          </TSpan>
        </SvgText>

        <SvgText x={colWidth * 1.5} y={55} textAnchor="middle">
          <TSpan fontSize={24} fontWeight="600" fill={Brand.white} fillOpacity={0.5}>
            PACE
          </TSpan>
        </SvgText>
        <SvgText x={colWidth * 1.5} y={105} textAnchor="middle">
          <TSpan fontSize={42} fontWeight="700" fill={Brand.white}>
            {formatPace(distance, duration)}
          </TSpan>
        </SvgText>

        <SvgText x={colWidth * 2.5} y={55} textAnchor="middle">
          <TSpan fontSize={24} fontWeight="600" fill={Brand.white} fillOpacity={0.5}>
            TERRITORY
          </TSpan>
        </SvgText>
        <SvgText x={colWidth * 2.5} y={105} textAnchor="middle">
          <TSpan fontSize={42} fontWeight="700" fill={Brand.white}>
            {territoryArea > 0 ? formatArea(territoryArea) : '\u2014'}
          </TSpan>
        </SvgText>

        {/* Route (clipped to middle zone) — omitted entirely for manual
            entries with no coordinates, e.g. a treadmill run. */}
        {shapes && (
          <G clipPath="url(#routeClip)">
            {shapes.territoryPath && (
              <Path
                d={shapes.territoryPath}
                fill={Brand.primaryTint}
                stroke={Brand.success}
                strokeWidth={4}
              />
            )}
            {shapes.routePath && (
              <>
                <Path
                  d={shapes.routePath}
                  fill="none"
                  stroke={Brand.primary}
                  strokeWidth={16}
                  strokeOpacity={0.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={shapes.routePath}
                  fill="none"
                  stroke={Brand.primary}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
            {shapes.routeDot && (
              <Circle cx={shapes.routeDot.cx} cy={shapes.routeDot.cy} r={12} fill={Brand.primary} />
            )}
            {shapes.start && (
              <Circle
                cx={shapes.start.cx}
                cy={shapes.start.cy}
                r={10}
                fill={Brand.success}
                stroke="#fff"
                strokeWidth={3}
              />
            )}
            {shapes.end && (
              <Circle
                cx={shapes.end.cx}
                cy={shapes.end.cy}
                r={10}
                fill={Brand.primary}
                stroke="#fff"
                strokeWidth={3}
              />
            )}
          </G>
        )}

        {/* Distance above logo */}
        <SvgText x={WIDTH / 2} y={HEIGHT - 80 - 60 * 1.0 - 50} textAnchor="middle">
          <TSpan fontSize={72} fontWeight="700" fill={Brand.white}>
            {formatDistance(distance)}
          </TSpan>
        </SvgText>

        {/* Logo */}
        <LogoPaths
          logoWidth={262}
          logoScale={1.0}
          logoY={HEIGHT - 80 - 60 * 1.0}
          canvasWidth={WIDTH}
        />
      </Svg>
    </View>
  );
});

const LogoPaths = ({
  logoWidth,
  logoScale,
  logoY,
  canvasWidth,
}: {
  logoWidth: number;
  logoScale: number;
  logoY: number;
  canvasWidth: number;
}) => (
  <>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M46.432 0.0115248L109.456 0.0425532C113.08 0.0425532 116.312 0.851064 119.15 2.46809C121.988 4.08511 124.221 6.29788 125.851 9.10638C127.481 11.9149 128.296 15.1206 128.296 18.7234C128.296 23.1489 127.073 26.9645 124.629 30.1702C122.212 33.3475 119.009 35.5177 115.019 36.6809L130.909 59.9149H115.483L100.099 37.4043H94.7887V59.9149H82.0603V12.7092H31.8772V12.703C29.0741 12.695 25.1685 12.6809 23.6866 12.6809C21.4669 12.6809 19.7389 13.078 18.5025 13.8723C16.8448 14.922 16.0159 16.2553 16.0159 17.8723C16.0159 18.5816 16.2828 19.3759 16.8167 20.2553C17.3505 21.1064 18.3761 21.8014 19.8934 22.3404C22.1412 22.9929 24.4453 23.461 26.8055 23.7447C29.2781 24.0284 31.7227 24.539 34.1391 25.2766C38.691 26.922 42.0627 29.2766 44.2544 32.3404C46.3055 35.2057 47.3311 38.2695 47.3311 41.5319C47.3311 44.0284 46.7691 46.4255 45.6452 48.7234C44.6056 50.8511 43.0883 52.766 41.0934 54.4681C39.1265 56.1418 36.682 57.4894 33.7598 58.5106C30.8376 59.5035 27.4518 60 23.6023 60C19.219 60 14.8638 58.8511 10.5368 56.5532C6.20967 54.2553 2.69741 51.2766 0 47.617L9.77811 39.3617C11.2673 41.6312 13.2763 43.5035 15.8051 44.9787C18.3621 46.4539 20.9611 47.1915 23.6023 47.1915C25.8783 47.1915 27.7327 46.9504 29.1657 46.4681C30.5987 45.9574 31.6524 45.3191 32.3268 44.5532C33.0292 43.7872 33.3804 42.9645 33.3804 42.0851C33.3804 40.8936 32.7763 39.773 31.5681 38.7234C30.388 37.6454 28.674 36.8652 26.4262 36.383C25.5271 36.2128 24.5998 36.0567 23.6445 35.9149C20.8347 35.6028 17.9827 34.8936 15.0886 33.7872C9.91861 31.5177 6.5047 28.9787 4.84691 26.1702C3.32962 23.617 2.57097 20.8936 2.57097 18L2.61312 17.1064C2.61312 15.0355 3.04864 12.9929 3.91967 10.9787C4.79071 8.96455 6.09728 7.14893 7.83935 5.53191C9.58142 3.88653 11.759 2.58156 14.3721 1.61702C17.0134 0.624114 20.3149 0 23.8271 0H46.432V0.0115248ZM94.7887 35.9149L102.544 24.5532H109.456C111.282 24.5532 112.757 24.0425 113.881 23.0213C115.005 21.9716 115.567 20.539 115.567 18.7234C115.567 16.8794 115.005 15.4468 113.881 14.4255C112.757 13.4043 111.282 12.8936 109.456 12.8936H94.7887V35.9149Z"
      fill={Brand.white}
      transform={`translate(${(canvasWidth - logoWidth * logoScale) / 2}, ${logoY}) scale(${logoScale})`}
    />
    <Path
      d="M64.3726 59.9149H51.6442V20.766L62.8974 12.8936H64.3726V59.9149Z"
      fill={Brand.white}
      transform={`translate(${(canvasWidth - logoWidth * logoScale) / 2}, ${logoY}) scale(${logoScale})`}
    />
    <Path
      d="M146.011 16.9362L155.832 0.0425532H171.089L152.376 32.0426V59.9149H139.647V39.4894L150.69 32.0426H139.521L120.934 0.0425532H136.149L146.011 16.9362Z"
      fill={Brand.white}
      transform={`translate(${(canvasWidth - logoWidth * logoScale) / 2}, ${logoY}) scale(${logoScale})`}
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M194.86 0.0425532C198.99 0.0425532 202.741 0.851064 206.113 2.46809C209.513 4.05674 212.421 6.24114 214.837 9.02128C217.254 11.773 219.122 14.9645 220.443 18.5957C221.764 22.1986 222.424 26 222.424 30C222.424 34.1702 221.792 38.0709 220.527 41.7021C219.291 45.3333 217.479 48.5106 215.09 51.234C212.73 53.9291 209.836 56.0567 206.408 57.617C203.008 59.1489 199.159 59.9149 194.86 59.9149H171.089V0.0425532H194.86ZM183.775 47.0638H194.86C198.26 47.0638 201.041 46.312 203.205 44.8085C205.397 43.2766 207.026 41.2198 208.094 38.6383C209.162 36.0567 209.696 33.1773 209.696 30C209.696 27.0213 209.12 24.2411 207.967 21.6596C206.815 19.0496 205.13 16.9362 202.91 15.3191C200.718 13.7021 198.035 12.8936 194.86 12.8936H183.775V47.0638Z"
      fill={Brand.white}
      transform={`translate(${(canvasWidth - logoWidth * logoScale) / 2}, ${logoY}) scale(${logoScale})`}
    />
    <Path
      d="M262 12.8936H235.152V24.6809H257.069V37.5319H242.907L235.152 26.1702V47.2296L262 47.2057V59.9149H222.424V0.0425532H262V12.8936Z"
      fill={Brand.white}
      transform={`translate(${(canvasWidth - logoWidth * logoScale) / 2}, ${logoY}) scale(${logoScale})`}
    />
  </>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
});
