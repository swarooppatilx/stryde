import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  bgColor?: string;
  label?: string;
  showPercent?: boolean;
}

export function ProgressRing({
  progress,
  size = 64,
  strokeWidth = 5,
  color,
  bgColor,
  label,
  showPercent = true,
}: ProgressRingProps) {
  const theme = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const displayProgress = clampedProgress < 0.005 ? 0 : clampedProgress;
  const strokeDashoffset = circumference * (1 - displayProgress);
  const trackColor = bgColor ?? theme.backgroundSelected;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap={displayProgress > 0 ? 'round' : 'butt'}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <ThemedText
          type="small"
          style={[
            styles.centerLabel,
            {
              width: size,
              height: size,
              fontSize: size * 0.22,
              color,
            },
          ]}
        >
          {showPercent
            ? `${Math.round(displayProgress * 100)}%`
            : `${Math.round(displayProgress * 100)}`}
        </ThemedText>
      </View>
      {label && (
        <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>
          {label}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  centerLabel: {
    position: 'absolute',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '700',
  },
});
