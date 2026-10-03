import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/button';
import { Notice } from '@/components/notice';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';
import { canConfirmStake, type StakeAlert } from '@/utils/stakeAlerts';

const BACKDROP_ALPHA = 0.5;

interface StakeConfirmProps {
  visible: boolean;
  title: string;
  /** What is about to be committed, in full: amounts, who, for how long. */
  summary: string;
  alerts: readonly StakeAlert[];
  confirmLabel: string;
  /** Held by the screen, so closing the sheet can clear it. */
  understood: boolean;
  onUnderstoodChange(understood: boolean): void;
  onConfirm(): void;
  onCancel(): void;
}

/** Final review before a stake is sent. Dangers block the button; warnings need an explicit "I understand". */
export function StakeConfirm({
  visible,
  title,
  summary,
  alerts,
  confirmLabel,
  understood,
  onUnderstoodChange,
  onConfirm,
  onCancel,
}: StakeConfirmProps) {
  const theme = useTheme();
  const hasWarning = alerts.some((a) => a.severity === 'warning');
  const canConfirm = canConfirmStake(alerts, understood);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="sectionTitle">{title}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {summary}
          </ThemedText>
          {alerts.map((alert) => (
            <Notice key={alert.id} severity={alert.severity}>
              {alert.message}
            </Notice>
          ))}
          {hasWarning ? (
            <Tappable
              onPress={() => {
                haptics.selection();
                onUnderstoodChange(!understood);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: understood }}
              accessibilityLabel="I understand"
              style={styles.understand}
            >
              <Ionicons
                name={understood ? 'checkbox' : 'square-outline'}
                size={22}
                color={understood ? theme.brand.primary : theme.textSecondary}
              />
              <ThemedText type="small">I understand</ThemedText>
            </Tappable>
          ) : null}
          <View style={styles.buttons}>
            <AppButton
              variant="secondary"
              fullWidth={false}
              style={styles.button}
              onPress={onCancel}
            >
              Not yet
            </AppButton>
            <AppButton
              fullWidth={false}
              style={styles.button}
              disabled={!canConfirm}
              onPress={onConfirm}
            >
              {confirmLabel}
            </AppButton>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: tint(Palette.black, BACKDROP_ALPHA),
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.three,
    gap: Spacing.twoHalf,
  },
  understand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  buttons: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  button: { flex: 1 },
});
