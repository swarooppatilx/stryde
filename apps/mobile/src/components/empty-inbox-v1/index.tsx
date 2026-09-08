import type React from 'react';
import { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import {
  ACTION_HEIGHT,
  ACTION_HORIZONTAL_PADDING,
  COLORS,
  CONTENT_HORIZONTAL_PADDING,
  DEFAULT_ACTION_LABEL,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  PULSE_DURATION,
  PULSE_MAX_OPACITY,
  PULSE_MIN_OPACITY,
  SKELETON_CIRCLE_SIZE,
  SKELETON_LINE_GAP,
  SKELETON_LINE_HEIGHT,
  SKELETON_LINE_RADIUS,
  SKELETON_ROW_GAP,
  SKELETON_ROWS,
} from './const';
import type { IEmptyInboxColors, IEmptyInboxState, IGlyph, ISkeletonRow } from './types';

const PlusGlyph: React.FC<IGlyph> = ({ size = 19, color = COLORS.actionLabel }: IGlyph) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5V19M5 12H19" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
  </Svg>
);

const SkeletonRow: React.FC<ISkeletonRow & { skeletonColor: string; skeletonStrongColor: string }> =
  memo(
    ({
      opacity,
      scale,
      lineWidths,
      skeletonColor,
      skeletonStrongColor,
    }: ISkeletonRow & { skeletonColor: string; skeletonStrongColor: string }) => (
      <View
        style={[styles.skeletonRow, { opacity, transform: [{ scale }] }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.skeletonCircle, { backgroundColor: skeletonColor }]} />

        <View>
          {lineWidths.map((width, index) => (
            <View
              key={width}
              style={[
                styles.skeletonLine,
                { width, backgroundColor: skeletonColor },
                index === 0 ? { backgroundColor: skeletonStrongColor } : null,
                index === lineWidths.length - 1 ? styles.skeletonLineLast : null,
              ]}
            />
          ))}
        </View>
      </View>
    )
  );
SkeletonRow.displayName = 'SkeletonRow';

const EmptyInboxState: React.FC<IEmptyInboxState> = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  actionLabel = DEFAULT_ACTION_LABEL,
  hideAction = false,
  animated = true,
  style,
  onActionPress,
  colors: colorsProp,
}: IEmptyInboxState) => {
  const colors: Required<IEmptyInboxColors> = { ...COLORS, ...colorsProp };
  const pulse = useSharedValue<number>(PULSE_MAX_OPACITY);
  const [isActionPressed, setIsActionPressed] = useState<boolean>(false);

  const handlePressIn = useCallback((): void => setIsActionPressed(true), []);
  const handlePressOut = useCallback((): void => setIsActionPressed(false), []);

  useEffect(() => {
    if (!animated) {
      cancelAnimation(pulse);
      pulse.value = PULSE_MAX_OPACITY;
      return;
    }

    pulse.value = withRepeat(
      withTiming(PULSE_MIN_OPACITY, {
        duration: PULSE_DURATION,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true
    );

    return () => cancelAnimation(pulse);
  }, [animated, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={[styles.container, { backgroundColor: colors.screen }, style]}>
      <Animated.View style={[styles.stack, pulseStyle]}>
        {SKELETON_ROWS.map((row, index) => (
          <SkeletonRow
            key={`skeleton-${index}`}
            {...row}
            skeletonColor={colors.skeleton}
            skeletonStrongColor={colors.skeletonStrong}
          />
        ))}
      </Animated.View>

      <Text style={[styles.title, { color: colors.title }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.description }]}>{description}</Text>

      {hideAction ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onActionPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.action,
            { backgroundColor: colors.accent, shadowColor: colors.accent },
            isActionPressed ? { backgroundColor: colors.accentPressed } : null,
          ]}
        >
          <PlusGlyph color={colors.actionLabel} />
          <Text style={[styles.actionLabel, { color: colors.actionLabel }]} numberOfLines={1}>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
  },
  stack: {
    marginBottom: 22,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SKELETON_ROW_GAP,
  },
  skeletonCircle: {
    width: SKELETON_CIRCLE_SIZE,
    height: SKELETON_CIRCLE_SIZE,
    borderRadius: SKELETON_CIRCLE_SIZE / 2,
    marginRight: 16,
  },
  skeletonLine: {
    height: SKELETON_LINE_HEIGHT,
    borderRadius: SKELETON_LINE_RADIUS,
    marginBottom: SKELETON_LINE_GAP,
  },
  skeletonLineLast: {
    marginBottom: 0,
  },
  title: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  description: {
    maxWidth: 300,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 26,
    height: ACTION_HEIGHT,
    paddingHorizontal: ACTION_HORIZONTAL_PADDING,
    borderRadius: ACTION_HEIGHT / 2,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});

export type { IEmptyInboxState, IGlyph, ISkeletonRow } from './types';
export { EmptyInboxState };
export default memo(EmptyInboxState);
