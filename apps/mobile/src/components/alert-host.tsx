import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type AlertButton, useAlertStore } from '@/stores/alertStore';
import { haptics } from '@/utils/haptics';

/** Mounted once at the app root. Renders whatever `@/utils/alert`'s `Alert`
 * shim currently has active — a themed modal card instead of the OS-native
 * alert dialog, matching light/dark mode. */
export function AlertHost() {
  const theme = useTheme();
  const visible = useAlertStore((s) => s.visible);
  const title = useAlertStore((s) => s.title);
  const message = useAlertStore((s) => s.message);
  const buttons = useAlertStore((s) => s.buttons);
  const hide = useAlertStore((s) => s.hide);
  // 3+ options (an action-sheet-style choice, not a simple confirm) reads
  // better stacked — a row starts wrapping/squeezing text at that point.
  const stacked = buttons.length > 2;

  const handlePress = (button: AlertButton) => {
    haptics.tap();
    hide();
    button.onPress?.();
  };

  const textColorFor = (style: AlertButton['style']) => {
    if (style === 'destructive') return theme.brand.danger;
    if (style === 'cancel') return theme.textSecondary;
    return theme.brand.primary;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={hide}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={hide}
          accessibilityLabel="Dismiss dialog"
        />
        <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="sectionTitle" style={styles.title}>
            {title}
          </ThemedText>
          {message ? (
            <ThemedText type="small" style={[styles.message, { color: theme.textSecondary }]}>
              {message}
            </ThemedText>
          ) : (
            <View style={styles.messageSpacer} />
          )}
          <View
            style={[
              styles.buttonRow,
              { borderTopColor: theme.border },
              stacked && styles.buttonColumn,
            ]}
          >
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={`${button.text}-${index}`}
                style={[
                  styles.button,
                  stacked && styles.buttonStacked,
                  index > 0 &&
                    (stacked
                      ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }
                      : {
                          borderLeftWidth: StyleSheet.hairlineWidth,
                          borderLeftColor: theme.border,
                        }),
                ]}
                onPress={() => handlePress(button)}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <ThemedText
                  type="default"
                  style={[
                    styles.buttonText,
                    { color: textColorFor(button.style) },
                    (!button.style || button.style === 'default') && styles.buttonTextEmphasis,
                  ]}
                >
                  {button.text}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
  },
  card: {
    width: '100%',
    maxWidth: 280,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    paddingTop: Spacing.three + Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginTop: Spacing.one,
    marginBottom: Spacing.one,
  },
  messageSpacer: {
    height: Spacing.one,
  },
  buttonRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.three,
    marginHorizontal: -Spacing.three,
  },
  buttonColumn: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.two + Spacing.one,
    alignItems: 'center',
  },
  buttonStacked: {
    flex: 0,
  },
  buttonText: {
    fontSize: 15,
  },
  buttonTextEmphasis: {
    fontWeight: '700',
  },
});
