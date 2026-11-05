import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { PUSH_PRIMER_COPY as C } from '@/constants/copy';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface PushPrimerSheetProps {
  visible: boolean;
  onAllow: () => void;
  onNotNow: () => void;
}

/** Says why notifications are worth allowing before the system asks, so the one real prompt is not wasted. */
export function PushPrimerSheet({ visible, onAllow, onNotNow }: PushPrimerSheetProps) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onNotNow}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: tint(Palette.black, 0.4) }]}
        onPress={onNotNow}
        accessibilityRole="button"
        accessibilityLabel={C.notNow}
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.backgroundElement,
            paddingBottom: Math.max(bottom, Spacing.two) + Spacing.two,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        <Ionicons name="notifications-outline" size={32} color={theme.brand.primary} />
        <ThemedText type="sectionTitle">{C.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {C.body}
        </ThemedText>
        <View style={styles.actions}>
          <AppButton onPress={onAllow}>{C.allow}</AppButton>
          <AppButton variant="secondary" onPress={onNotNow}>
            {C.notNow}
          </AppButton>
        </View>
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
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.two,
  },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
});
