import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSize, Spacing, Touch } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Close on the left, the screen's name in the middle; saving lives in the pinned button below. */
export function SaveHeader({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={['top']}>
      <ThemedView style={[styles.header, { borderBottomColor: theme.border }]}>
        <Tappable
          onPress={onClose}
          style={styles.side}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Ionicons name="close" size={IconSize.action} color={theme.text} />
        </Tappable>
        <ThemedText type="sectionTitle" accessibilityRole="header">
          Save activity
        </ThemedText>
        <ThemedView style={styles.side} />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: {
    width: Touch.target,
    height: Touch.target,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
