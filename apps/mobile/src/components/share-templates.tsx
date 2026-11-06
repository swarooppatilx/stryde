import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Line, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import { Palette } from '@/constants/palette';
import { Brand } from '@/constants/theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { formatDistance, formatDurationLong } from '@/utils/format';
import { shareCardStats, shareSplitBars } from '@/utils/shareDesigns';
import {
  CARD_INSET,
  CARD_RADIUS,
  LogoPaths,
  RouteLayer,
  routeShapes,
  type ShareRouteImageProps,
  WIDTH,
} from './share-card-parts';

const MONO = 'monospace';

/** The route drawn as large as the canvas allows, with just the distance beneath it. */
export function BigRouteCard({
  coordinates,
  territory,
  distance,
  duration,
  activityType = 'run',
  height = WIDTH,
  ref,
}: ShareRouteImageProps) {
  const unitSystem = useUnitSystem();
  const routeTop = 120;
  const routeHeight = height - routeTop - 420;
  const shapes = routeShapes(coordinates, territory, routeTop, routeHeight);
  const stats = shareCardStats({ activityType, distance, duration }, unitSystem).filter(
    (s) => s.label !== 'Distance'
  );
  const baseY = routeTop + routeHeight + 150;

  return (
    <View style={{ width: WIDTH, height }}>
      <Svg ref={ref} width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
        <Defs>
          <ClipPath id="bigRouteClip">
            <Rect x={0} y={routeTop} width={WIDTH} height={routeHeight} />
          </ClipPath>
        </Defs>
        <RouteLayer shapes={shapes} clipId="bigRouteClip" />
        <SvgText x={WIDTH / 2} y={baseY} textAnchor="middle">
          <TSpan fontSize={120} fontWeight="800" fill={Brand.white}>
            {formatDistance(distance, unitSystem)}
          </TSpan>
        </SvgText>
        <SvgText x={WIDTH / 2} y={baseY + 70} textAnchor="middle">
          <TSpan fontSize={40} fontWeight="600" fill={Brand.white} fillOpacity={0.8}>
            {stats.map((s) => s.value).join('   ·   ')}
          </TSpan>
        </SvgText>
        <LogoPaths logoWidth={262} logoScale={0.8} logoY={height - 170} canvasWidth={WIDTH} />
      </Svg>
    </View>
  );
}

/** A huge distance with time and pace under it and no route: a text sticker for a story. */
export function MinimalCard({
  distance,
  duration,
  activityType = 'run',
  height = WIDTH,
  title,
  ref,
}: ShareRouteImageProps) {
  const unitSystem = useUnitSystem();
  const stats = shareCardStats({ activityType, distance, duration }, unitSystem).filter(
    (s) => s.label !== 'Distance'
  );
  const midY = height / 2;

  return (
    <View style={{ width: WIDTH, height }}>
      <Svg ref={ref} width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
        {title ? (
          <SvgText x={WIDTH / 2} y={midY - 190} textAnchor="middle">
            <TSpan fontSize={44} fontWeight="600" fill={Brand.white} fillOpacity={0.85}>
              {title.length > 28 ? `${title.slice(0, 27)}…` : title}
            </TSpan>
          </SvgText>
        ) : null}
        <SvgText x={WIDTH / 2} y={midY + 40} textAnchor="middle">
          <TSpan fontSize={230} fontWeight="800" fill={Brand.white}>
            {formatDistance(distance, unitSystem)}
          </TSpan>
        </SvgText>
        <SvgText x={WIDTH / 2} y={midY + 160} textAnchor="middle">
          <TSpan fontSize={56} fontWeight="600" fill={Brand.white} fillOpacity={0.9}>
            {stats.map((s) => s.value).join('   ·   ')}
          </TSpan>
        </SvgText>
        <LogoPaths logoWidth={262} logoScale={0.8} logoY={height - 170} canvasWidth={WIDTH} />
      </Svg>
    </View>
  );
}

/** A light paper receipt: the run itemised, with a small route on top. The one card that reads on a light story. */
export function ReceiptCard({
  coordinates,
  territory,
  distance,
  duration,
  activityType = 'run',
  height = WIDTH,
  extraStats = [],
  title,
  dateLabel,
  ref,
}: ShareRouteImageProps) {
  const unitSystem = useUnitSystem();
  const stats = [
    ...shareCardStats({ activityType, distance, duration }, unitSystem),
    ...extraStats,
  ];
  const paperTop = 200;
  const paperLeft = CARD_INSET * 2;
  const paperWidth = WIDTH - CARD_INSET * 4;
  const routeTop = paperTop + 130;
  // A treadmill or manual entry has no route: keep the paper compact instead of leaving a blank hole.
  const routeHeight = coordinates.length > 1 ? 520 : 60;
  const shapes = routeShapes(coordinates, territory, routeTop, routeHeight);
  // Title and date sit under the route; the rule and the rows start below them.
  const rowsTop = routeTop + routeHeight + 260;
  const rowGap = 92;
  const ink = Palette.black;
  // The paper ends just below the last row, like a real receipt, instead of stretching to the canvas.
  const rowCount = Math.min(stats.length, 6);
  const paperHeight = Math.min(
    height - paperTop - 260,
    rowsTop - paperTop + rowCount * rowGap + 40
  );

  return (
    <View style={{ width: WIDTH, height }}>
      <Svg ref={ref} width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
        <Defs>
          <ClipPath id="receiptRouteClip">
            <Rect x={paperLeft} y={routeTop} width={paperWidth} height={routeHeight} />
          </ClipPath>
        </Defs>
        <Rect
          x={paperLeft}
          y={paperTop}
          width={paperWidth}
          height={paperHeight}
          rx={CARD_RADIUS / 4}
          fill={Palette.white}
        />
        <SvgText x={WIDTH / 2} y={paperTop + 90} textAnchor="middle">
          <TSpan fontFamily={MONO} fontSize={56} fontWeight="700" fill={ink}>
            STRYDE RECEIPT
          </TSpan>
        </SvgText>
        <RouteLayer shapes={shapes} clipId="receiptRouteClip" />
        <SvgText x={paperLeft + 60} y={routeTop + routeHeight + 70}>
          <TSpan fontFamily={MONO} fontSize={38} fill={ink}>
            {(title ?? 'Activity').toUpperCase().slice(0, 30)}
          </TSpan>
        </SvgText>
        {dateLabel ? (
          <SvgText x={paperLeft + 60} y={routeTop + routeHeight + 118}>
            <TSpan fontFamily={MONO} fontSize={32} fill={ink} fillOpacity={0.6}>
              {dateLabel}
            </TSpan>
          </SvgText>
        ) : null}
        <Line
          x1={paperLeft + 60}
          x2={paperLeft + paperWidth - 60}
          y1={rowsTop - 50}
          y2={rowsTop - 50}
          stroke={ink}
          strokeWidth={3}
          strokeDasharray="14 10"
          strokeOpacity={0.5}
        />
        {stats.slice(0, 6).map((stat, i) => (
          <SvgText key={stat.label} x={paperLeft + 60} y={rowsTop + i * rowGap}>
            <TSpan fontFamily={MONO} fontSize={44} fill={ink}>
              {stat.label.toUpperCase()}
            </TSpan>
            <TSpan
              fontFamily={MONO}
              fontSize={44}
              fontWeight="700"
              fill={ink}
              dx={0}
              x={paperLeft + paperWidth - 60}
              textAnchor="end"
            >
              {stat.value}
            </TSpan>
          </SvgText>
        ))}
        <SvgText x={WIDTH / 2} y={paperTop + paperHeight - 50} textAnchor="middle">
          <TSpan fontFamily={MONO} fontSize={32} fill={ink} fillOpacity={0.6}>
            THANK YOU FOR MOVING
          </TSpan>
        </SvgText>
      </Svg>
    </View>
  );
}

/** Pace per split as horizontal bars, fastest longest, under the route. */
export function SplitsCard({
  coordinates,
  territory,
  distance,
  duration,
  activityType = 'run',
  height = WIDTH,
  splits = [],
  ref,
}: ShareRouteImageProps) {
  const unitSystem = useUnitSystem();
  const bars = shareSplitBars(splits, activityType, unitSystem);
  const routeTop = 220;
  const routeHeight = 420;
  const shapes = routeShapes(coordinates, territory, routeTop, routeHeight);
  const barsTop = routeTop + routeHeight + 140;
  const rowHeight = Math.min(96, (height - barsTop - 300) / Math.max(bars.length, 1));
  const labelWidth = 90;
  const paceWidth = 230;
  const barLeft = CARD_INSET * 2 + labelWidth;
  const barMax = WIDTH - CARD_INSET * 2 - paceWidth - barLeft;

  return (
    <View style={{ width: WIDTH, height }}>
      <Svg ref={ref} width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
        <Defs>
          <ClipPath id="splitsRouteClip">
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
          fillOpacity={0.85}
        />
        <SvgText x={WIDTH / 2} y={CARD_INSET * 3 + 100} textAnchor="middle">
          <TSpan fontSize={44} fontWeight="700" fill={Brand.white}>
            {formatDistance(distance, unitSystem)} · {formatDurationLong(duration)}
          </TSpan>
        </SvgText>
        <RouteLayer shapes={shapes} clipId="splitsRouteClip" />
        {bars.map((bar, i) => {
          const y = barsTop + i * rowHeight;
          return (
            <G key={`${bar.label}-${i}`}>
              <SvgText
                x={CARD_INSET * 2 + labelWidth - 20}
                y={y + rowHeight * 0.62}
                textAnchor="end"
              >
                <TSpan
                  fontSize={rowHeight * 0.45}
                  fontWeight="600"
                  fill={Brand.white}
                  fillOpacity={0.7}
                >
                  {bar.label}
                </TSpan>
              </SvgText>
              <Rect
                x={barLeft}
                y={y + rowHeight * 0.18}
                width={Math.max(barMax * bar.ratio, 8)}
                height={rowHeight * 0.56}
                rx={rowHeight * 0.12}
                fill={Brand.primary}
              />
              <SvgText x={WIDTH - CARD_INSET * 2} y={y + rowHeight * 0.62} textAnchor="end">
                <TSpan fontSize={rowHeight * 0.45} fontWeight="700" fill={Brand.white}>
                  {bar.pace}
                </TSpan>
              </SvgText>
            </G>
          );
        })}
        <LogoPaths logoWidth={262} logoScale={0.8} logoY={height - 230} canvasWidth={WIDTH} />
      </Svg>
    </View>
  );
}
