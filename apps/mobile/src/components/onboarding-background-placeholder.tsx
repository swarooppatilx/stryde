import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

import { Brand, tint } from '@/constants/theme';

/**
 * Stand-in for a real background photo on the onboarding screen - a plain
 * diagonal-stripe pattern, deliberately abstract so it doesn't get mistaken
 * for a finished design.
 *
 * To swap in a real photo once one is licensed/shot:
 *   <Image
 *     source={require('@/assets/images/onboarding-background.jpg')}
 *     resizeMode="cover"
 *     style={StyleSheet.absoluteFill}
 *   />
 * ...in place of <OnboardingBackgroundPlaceholder /> in onboarding.tsx.
 */
export function OnboardingBackgroundPlaceholder() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <Pattern
            id="stripes"
            width={28}
            height={28}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <Rect width={28} height={28} fill={Brand.primaryPressed} />
            <Line x1={0} y1={0} x2={0} y2={28} stroke={tint(Brand.primary, 0.5)} strokeWidth={14} />
          </Pattern>
        </Defs>
        <Rect width={width} height={height} fill="url(#stripes)" />
      </Svg>
    </View>
  );
}
