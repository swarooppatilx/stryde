import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppSwitch } from '@/components/app-switch';
import { ThemedText } from '@/components/themed-text';
import { HIDDEN_STAT_OPTIONS } from '@/constants/activity';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { HiddenStat } from '@/types';

interface Props {
  visible: boolean;
  hidden: readonly HiddenStat[];
  onChange: (stat: HiddenStat, hidden: boolean) => void;
  onClose: () => void;
}

/** A bottom sheet of switches, one per figure that can be kept from other people. */
export function HiddenDetailsSheet({ visible, hidden, onChange, onClose }: Props) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: tint(Palette.black, 0.4) }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close hidden details"
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.backgroundElement, paddingBottom: bottom + Spacing.three },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        <ThemedText type="sectionTitle">Hidden details</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Hidden from other people in the app. You always see everything. Distance and time stay
          public.
        </ThemedText>
        {HIDDEN_STAT_OPTIONS.map((option) => (
          <View key={option.value} style={styles.row}>
            <ThemedText style={styles.label}>{option.label}</ThemedText>
            <AppSwitch
              checked={hidden.includes(option.value)}
              onChange={(on) => onChange(option.value, on)}
              label={`Hide ${option.label.toLowerCase()}`}
            />
          </View>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: StyleSheet.absoluteFill,
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 48,
  },
  label: { flex: 1 },
});
