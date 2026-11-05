import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

interface IShimmerEffect {
  readonly isLoading?: boolean;
  readonly shimmerColors?: string[];
  readonly duration?: number;
  /** @deprecated */
  readonly style?: ViewStyle;
  readonly variant?: 'shimmer' | 'pulse';
  readonly direction?: ShimmerDirection;
  readonly preset?: ShimmerPreset;
  readonly opacity?: number;
  readonly children?: ReactNode;
}

type ShimmerDirection = 'leftToRight' | 'rightToLeft' | 'topToBottom' | 'bottomToTop';

type ShimmerPreset = 'onDark' | 'onLight' | 'twitter' | 'neutral' | 'custom';

interface IShimmerColorTheme {
  colors: string[];
  readonly backgroundColor?: string;
}

export type { IShimmerColorTheme, IShimmerEffect, ShimmerDirection, ShimmerPreset };
