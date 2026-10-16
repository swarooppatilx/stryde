import type { ReactNode } from 'react';
import type { Animated, ImageSourcePropType, StyleProp, TextStyle, ViewStyle } from 'react-native';

export interface ParallaxHeaderProps {
  title: string;

  subtitle?: string;

  infoText?: string;

  coverImage: ImageSourcePropType;

  /** Background image for the top of the header (will have blur applied) If not provided, coverImage will be used */
  backgroundImage?: ImageSourcePropType;

  /** @default 380 */
  expandedHeight?: number;

  /** @default 90 */
  collapsedHeight?: number;

  navbarTitle?: string;

  children: ReactNode;

  /** @default '#000000' */
  headerBackgroundColor?: string;

  /** @default '#FFFFFF' */
  headerTextColor?: string;

  /** @default true */
  enableBlur?: boolean;

  /** @default 60 */
  blurIntensity?: number;

  /** @default 'rgba(0, 0, 0, 0.6)' */
  blurTint?: 'light' | 'dark' | 'default';

  titleStyle?: StyleProp<TextStyle>;

  subtitleStyle?: StyleProp<TextStyle>;

  infoTextStyle?: StyleProp<TextStyle>;

  coverImageContainerStyle?: StyleProp<ViewStyle>;

  coverImageStyle?: StyleProp<ViewStyle>;

  actions?: {
    icon: ReactNode;
    onPress: () => void;
  }[];

  leftNavIcon?: ReactNode;

  rightNavIcon?: ReactNode;

  onLeftNavIconPress?: () => void;

  onRightNavIconPress?: () => void;

  /** @default 0 */
  bottomSpacing?: number;

  /** Animation spring configuration for parallax effects */
  animationConfig?: {
    dampingRatio?: number;
    stiffness?: number;
    overshootClamping?: boolean;
    restDisplacementThreshold?: number;
    restSpeedThreshold?: number;
  };

  coverImageShadow?: {
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    shadowOpacity?: number;
    shadowRadius?: number;
    elevation?: number;
  };

  /** Enable or disable the floating effect on the cover image during scroll @default true */
  enableFloatingCover?: boolean;

  /** Amount of scaling applied to the cover when fully expanded @default 1.0 */
  coverScaleAmount?: number;

  /** @default 1.0 */
  collapsedBackgroundOpacity?: number;

  /** @default true */
  showGradientOverlay?: boolean;

  /** @default ['transparent', 'rgba(0,0,0,0.7)'] */
  gradientColors?: [string, string, ...string[]];

  onScroll?: (position: number) => void;

  renderHeaderContent?: (animatedProps: {
    scrollY: AnimatedValue;
    titleOpacity: AnimatedValue;
    coverScale: AnimatedValue;
    coverTranslateY: AnimatedValue;
    headerHeight: AnimatedValue;
  }) => ReactNode;
}

type AnimatedValue = Animated.Value | Animated.AnimatedInterpolation<string | number>;
