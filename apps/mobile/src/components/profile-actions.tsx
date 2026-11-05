import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

interface ProfileActionsProps {
  onEdit(): void;
  onShare(): void;
  /** Absent when there is no link to show yet. */
  onShowQr?(): void;
}

/** The outlined pills under the header: edit the profile, share it, show its QR code. */
export function ProfileActions({ onEdit, onShare, onShowQr }: ProfileActionsProps) {
  const theme = useTheme();
  const pill = [styles.pill, { borderColor: theme.borderBold }];
  return (
    <View style={styles.row}>
      <Tappable onPress={onEdit} style={pill} accessibilityRole="button">
        <ThemedText type="button">Edit profile</ThemedText>
      </Tappable>
      <Tappable onPress={onShare} style={pill} accessibilityRole="button">
        <ThemedText type="button">Share profile</ThemedText>
      </Tappable>
      {onShowQr && (
        <Tappable
          onPress={onShowQr}
          style={[pill, styles.iconPill]}
          accessibilityRole="button"
          accessibilityLabel="Show QR code"
        >
          <Ionicons name="qr-code-outline" size={20} color={theme.text} />
        </Tappable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  pill: {
    flex: 1,
    minHeight: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPill: { flex: 0, width: 44 },
});
