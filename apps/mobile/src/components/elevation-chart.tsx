import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ElevationChartProps {
  elevations: number[];
  width?: number;
  height?: number;
}

export function ElevationChart({ elevations, width = 300, height = 80 }: ElevationChartProps) {
  const { isDark } = useTheme();
  const pathData = useMemo(() => {
    if (elevations.length < 2) return null;

    const min = Math.min(...elevations);
    const max = Math.max(...elevations);
    const range = max - min || 1;

    const padding = 4;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = elevations.map((e, i) => ({
      x: padding + (i / (elevations.length - 1)) * chartWidth,
      y: padding + chartHeight - ((e - min) / range) * chartHeight,
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return { linePath, areaPath };
  }, [elevations, width, height]);

  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);

  if (!pathData || elevations.length < 2) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Svg
        width={width}
        height={height}
        accessibilityRole="image"
        accessibilityLabel={`Elevation chart showing ${minElevation}m to ${maxElevation}m`}
      >
        <Defs>
          <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Brand.primary} stopOpacity={isDark ? 0.45 : 0.3} />
            <Stop offset="1" stopColor={Brand.primary} stopOpacity={isDark ? 0.12 : 0.05} />
          </LinearGradient>
        </Defs>
        <Path d={pathData.areaPath} fill="url(#gradient)" />
        <Path d={pathData.linePath} stroke={Brand.primary} strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});
