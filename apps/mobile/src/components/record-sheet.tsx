import type { ReactNode } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The grab handle at the top of a sheet. */
export function SheetHandle() {
  const theme = useTheme();
  return <View style={[styles.handle, { backgroundColor: theme.borderBold }]} />;
}

/** The panel pinned to the bottom of the Record screen, floating over the map. */
export function RecordSheet({
  children,
  onLayout,
}: {
  children: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea} onLayout={onLayout}>
      <View
        style={[styles.sheet, { backgroundColor: theme.backgroundElement }, theme.shadows.sheet]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: 'transparent' },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.four,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: BorderRadius.xxs,
    alignSelf: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
});
