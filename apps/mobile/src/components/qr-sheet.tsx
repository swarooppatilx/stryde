import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { QrCode } from '@/components/qr-code';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CODE_SIZE = 240;

interface Props {
  visible: boolean;
  title: string;
  /** The link the code opens. */
  link: string;
  onClose: () => void;
}

/** A bottom sheet with a QR code to scan from another phone. */
export function QrSheet({ visible, title, link, onClose }: Props) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: tint(Palette.black, 0.4) }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.backgroundElement, paddingBottom: bottom + Spacing.three },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        <ThemedText type="sectionTitle">{title}</ThemedText>
        {visible && <QrCode text={link} size={CODE_SIZE} label={`QR code for ${title}`} />}
        <ThemedText type="caption" themeColor="textSecondary">
          Scan with another phone to open it.
        </ThemedText>
        <AppButton variant="secondary" onPress={onClose}>
          Done
        </AppButton>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
    alignItems: 'center',
  },
  grabber: { width: 36, height: 4, borderRadius: BorderRadius.xxs },
});
