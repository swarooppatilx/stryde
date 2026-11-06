import { Modal, StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { type AlertButton, useAlertStore } from '@/stores/alertStore';
import { alertButtonColor } from '@/utils/alertColors';
import { haptics } from '@/utils/haptics';

/** Mounted once at the app root; renders the active `@/utils/alert` dialog as a themed modal card. */
export function AlertHost() {
  const theme = useTheme();
  const visible = useAlertStore((s) => s.visible);
  const title = useAlertStore((s) => s.title);
  const message = useAlertStore((s) => s.message);
  const buttons = useAlertStore((s) => s.buttons);
  const onDismiss = useAlertStore((s) => s.onDismiss);
  const hide = useAlertStore((s) => s.hide);
  // With 3 or more options a row starts squeezing text, so stack them.
  const stacked = buttons.length > 2;

  const dismiss = () => {
    hide();
    onDismiss?.();
  };

  const handlePress = (button: AlertButton) => {
    haptics.tap();
    hide();
    button.onPress?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Tappable
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={dismiss}
          accessibilityLabel="Dismiss dialog"
        />
        <ThemedView
          style={[
            styles.card,
            // The dark card is one step off the dimmed page; the hairline keeps its edge readable.
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
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
              <Tappable
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
                    { color: alertButtonColor(button.style, theme) },
                    (!button.style || button.style === 'default') && styles.buttonTextEmphasis,
                  ]}
                >
                  {button.text}
                </ThemedText>
              </Tappable>
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
    backgroundColor: tint(Palette.black, 0.5),
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
  },
  card: {
    width: '100%',
    maxWidth: 280,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
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
    ...textStyle(TypeScale.callout),
  },
  buttonTextEmphasis: {
    fontWeight: '700',
  },
});
