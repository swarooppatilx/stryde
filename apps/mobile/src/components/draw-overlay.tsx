import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '@/hooks/use-theme';

interface DrawOverlayProps {
  /** The stroke in points from the overlay's top-left, once the finger lifts. */
  onStroke(points: Array<[number, number]>): void;
}

/** Sits over the map while drawing: one finger traces the route, shown as it is drawn. */
export function DrawOverlay({ onStroke }: DrawOverlayProps) {
  const theme = useTheme();
  const [stroke, setStroke] = useState<Array<[number, number]>>([]);
  const points = useRef<Array<[number, number]>>([]);
  const onStrokeRef = useRef(onStroke);
  onStrokeRef.current = onStroke;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        points.current = [[e.nativeEvent.locationX, e.nativeEvent.locationY]];
        setStroke(points.current);
      },
      onPanResponderMove: (e) => {
        const next: [number, number] = [e.nativeEvent.locationX, e.nativeEvent.locationY];
        const last = points.current.at(-1);
        // Every few points is plenty for the line on screen and keeps re-renders cheap.
        if (last && Math.hypot(next[0] - last[0], next[1] - last[1]) < 4) return;
        points.current = [...points.current, next];
        setStroke(points.current);
      },
      onPanResponderRelease: () => {
        const done = points.current;
        points.current = [];
        setStroke([]);
        if (done.length > 1) onStrokeRef.current(done);
      },
      onPanResponderTerminate: () => {
        points.current = [];
        setStroke([]);
      },
    })
  ).current;

  return (
    <View
      style={StyleSheet.absoluteFill}
      {...responder.panHandlers}
      accessibilityLabel="Drawing area: trace your route with one finger"
    >
      {stroke.length > 1 && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Polyline
            points={stroke.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={theme.brand.primary}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.85}
          />
        </Svg>
      )}
    </View>
  );
}
