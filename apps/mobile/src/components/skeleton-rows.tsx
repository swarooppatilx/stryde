import { StyleSheet, View } from 'react-native';
import { shimmerPresetFor } from '@/components/Shimmer/const';
import { ShimmerEffect as Shimmer } from '@/components/Shimmer/Shimmer';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface SkeletonRowsProps {
  count: number;
  /** `name` is an avatar and one line; `nameAndMeta` adds a shorter second line under it. */
  variant?: 'name' | 'nameAndMeta';
}

/** Placeholder avatar rows while a list of people loads. */
export function SkeletonRows({ count, variant = 'name' }: SkeletonRowsProps) {
  const theme = useTheme();
  const preset = shimmerPresetFor(theme.isDark);
  return (
    <View accessibilityLabel="Loading" style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          <Shimmer isLoading preset={preset} style={styles.avatar} />
          {variant === 'nameAndMeta' ? (
            <View style={styles.lines}>
              <Shimmer isLoading preset={preset} style={styles.name} />
              <Shimmer isLoading preset={preset} style={styles.meta} />
            </View>
          ) : (
            <Shimmer isLoading preset={preset} style={styles.name} />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
    paddingHorizontal: Spacing.three,
    minHeight: 60,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  lines: { flex: 1, gap: Spacing.one },
  name: { width: '45%', height: 14, borderRadius: 4 },
  meta: { width: '30%', height: 10, borderRadius: 4 },
});
