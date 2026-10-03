import { Pressable, StyleSheet, View } from 'react-native';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { ThemedText } from './themed-text';

/** Full-screen count-in before recording; a tap on Cancel abandons the start. */
export function StartCountdownOverlay({
  remaining,
  onCancel,
}: {
  remaining: number;
  onCancel(): void;
}) {
  return (
    <View style={styles.overlay} accessibilityLiveRegion="assertive">
      <ThemedText style={[textStyle(TypeScale.countdown), styles.onScrim]}>{remaining}</ThemedText>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel the countdown"
        style={styles.cancel}
      >
        <ThemedText type="smallBold" style={styles.onScrim}>
          Cancel
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: tint(Palette.black, 0.72),
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.six,
  },
  // Always light: the scrim is dark in both themes.
  onScrim: { color: Palette.white },
  cancel: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: tint(Palette.white, 0.6),
  },
});
