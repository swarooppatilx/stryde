import { StyleSheet, View } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  Rect,
  Image as SvgImage,
  Text as SvgText,
  TSpan,
} from 'react-native-svg';
import {
  CARD_INSET,
  CARD_RADIUS,
  LOGO_HEIGHT,
  LogoPaths,
  RouteLayer,
  routeShapes,
  type ShareRouteImageProps,
  STATS_HEIGHT,
  StatColumns,
  WIDTH,
} from '@/components/share-card-parts';
import { BigRouteCard, MinimalCard, ReceiptCard, SplitsCard } from '@/components/share-templates';
import { Palette } from '@/constants/palette';
import { Brand } from '@/constants/theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import {
  formatArea,
  formatDistance,
  formatDurationLong,
  formatPaceOrSpeed,
  showsSpeed,
} from '@/utils/format';
import { shareCardStats } from '@/utils/shareDesigns';

function RouteCard({
  coordinates,
  territory,
  territoryArea,
  distance,
  duration,
  activityType = 'run',
  height = WIDTH,
  ref,
}: ShareRouteImageProps) {
  const unitSystem = useUnitSystem();
  const HEIGHT = height;
  const ROUTE_TOP = STATS_HEIGHT;
  const ROUTE_BOTTOM = HEIGHT - LOGO_HEIGHT;
  const ROUTE_HEIGHT = ROUTE_BOTTOM - ROUTE_TOP;

  const shapes = routeShapes(coordinates, territory, ROUTE_TOP, ROUTE_HEIGHT);

  const colWidth = WIDTH / 3;

  return (
    <View style={[styles.container, { width: WIDTH, height: HEIGHT }]}>
      <Svg ref={ref} width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <ClipPath id="routeClip">
            <Rect x={0} y={ROUTE_TOP} width={WIDTH} height={ROUTE_HEIGHT} />
          </ClipPath>
        </Defs>

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
            {showsSpeed(activityType) ? 'SPEED' : 'PACE'}
          </TSpan>
        </SvgText>
        <SvgText x={colWidth * 1.5} y={105} textAnchor="middle">
          <TSpan fontSize={42} fontWeight="700" fill={Brand.white}>
            {formatPaceOrSpeed(activityType, distance, duration, unitSystem)}
          </TSpan>
        </SvgText>

        <SvgText x={colWidth * 2.5} y={55} textAnchor="middle">
          <TSpan fontSize={24} fontWeight="600" fill={Brand.white} fillOpacity={0.5}>
            TERRITORY
          </TSpan>
        </SvgText>
        <SvgText x={colWidth * 2.5} y={105} textAnchor="middle">
          <TSpan fontSize={42} fontWeight="700" fill={Brand.white}>
            {territoryArea > 0 ? formatArea(territoryArea, unitSystem) : '\u2014'}
          </TSpan>
        </SvgText>

        <RouteLayer shapes={shapes} clipId="routeClip" />

        <SvgText x={WIDTH / 2} y={HEIGHT - 80 - 60 * 1.0 - 50} textAnchor="middle">
          <TSpan fontSize={72} fontWeight="700" fill={Brand.white}>
            {formatDistance(distance, unitSystem)}
          </TSpan>
        </SvgText>

        <LogoPaths
          logoWidth={262}
          logoScale={1.0}
          logoY={HEIGHT - 80 - 60 * 1.0}
          canvasWidth={WIDTH}
        />
      </Svg>
    </View>
  );
}

/** A dark rounded card with the route above and distance, time and pace beneath it. */
function StatsCard({
  coordinates,
  territory,
  distance,
  duration,
  activityType = 'run',
  height = WIDTH,
  ref,
}: ShareRouteImageProps) {
  const unitSystem = useUnitSystem();
  const routeTop = 240;
  const routeHeight = height - 240 - 640;
  const shapes = routeShapes(coordinates, territory, routeTop, routeHeight);
  const stats = shareCardStats({ activityType, distance, duration }, unitSystem);
  const dividerY = routeTop + routeHeight + 40;

  return (
    <View style={[styles.container, { width: WIDTH, height }]}>
      <Svg ref={ref} width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
        <Defs>
          <ClipPath id="statsRouteClip">
            <Rect x={0} y={routeTop} width={WIDTH} height={routeHeight} />
          </ClipPath>
        </Defs>
        <Rect
          x={CARD_INSET}
          y={CARD_INSET * 3}
          width={WIDTH - CARD_INSET * 2}
          height={height - CARD_INSET * 6}
          rx={CARD_RADIUS}
          fill={Palette.black}
          fillOpacity={0.82}
        />
        <RouteLayer shapes={shapes} clipId="statsRouteClip" />
        <Rect
          x={CARD_INSET * 3}
          y={dividerY}
          width={WIDTH - CARD_INSET * 6}
          height={2}
          fill={Brand.white}
          fillOpacity={0.2}
        />
        <StatColumns
          stats={stats}
          left={CARD_INSET * 2}
          width={WIDTH - CARD_INSET * 4}
          labelY={dividerY + 90}
          valueY={dividerY + 170}
        />
        <LogoPaths logoWidth={262} logoScale={0.8} logoY={dividerY + 280} canvasWidth={WIDTH} />
      </Svg>
    </View>
  );
}

/** The athlete's photo full-bleed under a scrim, with the route and stats laid over it. */
function PhotoCard({
  coordinates,
  territory,
  distance,
  duration,
  activityType = 'run',
  height = WIDTH,
  photoUri,
  ref,
}: ShareRouteImageProps) {
  const unitSystem = useUnitSystem();
  const routeTop = 200;
  const routeHeight = height - 200 - 620;
  const shapes = routeShapes(coordinates, territory, routeTop, routeHeight);
  const stats = shareCardStats({ activityType, distance, duration }, unitSystem);
  const statsTop = height - 560;

  return (
    <View style={[styles.container, { width: WIDTH, height }]}>
      <Svg ref={ref} width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
        <Defs>
          <ClipPath id="photoRouteClip">
            <Rect x={0} y={routeTop} width={WIDTH} height={routeHeight} />
          </ClipPath>
        </Defs>
        {photoUri ? (
          <SvgImage
            x={0}
            y={0}
            width={WIDTH}
            height={height}
            href={{ uri: photoUri }}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : null}
        <Rect x={0} y={0} width={WIDTH} height={height} fill={Palette.black} fillOpacity={0.3} />
        <Rect
          x={0}
          y={statsTop - 60}
          width={WIDTH}
          height={height - statsTop + 60}
          fill={Palette.black}
          fillOpacity={0.35}
        />
        <RouteLayer shapes={shapes} clipId="photoRouteClip" />
        <StatColumns
          stats={stats}
          left={CARD_INSET}
          width={WIDTH - CARD_INSET * 2}
          labelY={statsTop + 40}
          valueY={statsTop + 120}
        />
        <LogoPaths logoWidth={262} logoScale={0.8} logoY={statsTop + 260} canvasWidth={WIDTH} />
      </Svg>
    </View>
  );
}

/** The share card in the chosen design: route only (transparent), stats card, or photo card. */
export function ShareRouteImage(props: ShareRouteImageProps) {
  if (props.design === 'stats') return <StatsCard {...props} />;
  if (props.design === 'big-route') return <BigRouteCard {...props} />;
  if (props.design === 'minimal') return <MinimalCard {...props} />;
  if (props.design === 'receipt') return <ReceiptCard {...props} />;
  // Without two splits there is nothing to compare, so the stats card stands in.
  if (props.design === 'splits') {
    return (props.splits?.length ?? 0) >= 2 ? <SplitsCard {...props} /> : <StatsCard {...props} />;
  }
  if (props.design === 'photo' && props.photoUri) return <PhotoCard {...props} />;
  if (props.design === 'photo') return <StatsCard {...props} />;
  return <RouteCard {...props} />;
}

/** Height of the full-bleed 9:16 story card the share flow sends. */
const STORY_HEIGHT = 1920;
/** Far enough above the screen that the card is never seen while it is turned into a PNG. */
const OFF_SCREEN = -10000;

/** The story card mounted out of sight, ready for `shareRouteImage` to render through its ref. */
export function OffscreenShareImage(props: Omit<ShareRouteImageProps, 'height'>) {
  return (
    <View style={styles.offscreen} pointerEvents="none">
      <ShareRouteImage {...props} height={STORY_HEIGHT} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  offscreen: {
    position: 'absolute',
    top: OFF_SCREEN,
    left: 0,
    width: WIDTH,
    height: STORY_HEIGHT,
  },
});
