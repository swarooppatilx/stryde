import type { ReactElement } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { BorderRadius } from '@/constants/theme';

interface IconBadgeProps {
  backgroundColor?: string;
  size?: 'sm' | 'md';
  children: ReactElement;
  style?: ViewStyle;
}

const SIZES = { sm: 32, md: 40 } as const;

export function IconBadge({ backgroundColor, size = 'sm', children, style }: IconBadgeProps) {
  const dimension = SIZES[size];

  return (
    <View
      style={[
        styles.badge,
        { width: dimension, height: dimension, borderRadius: dimension / 2 },
        backgroundColor ? { backgroundColor } : undefined,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
});
