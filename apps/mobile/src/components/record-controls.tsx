import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Palette } from '@/constants/palette';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

const BUTTON_SIZE = 64;

function PillButton({
  icon,
  label,
  caption,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  caption: string;
  onPress(): void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.pill, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name={icon} size={28} color={Palette.white} />
      <ThemedText type="headline" style={styles.pillCaption}>
        {caption}
      </ThemedText>
    </Pressable>
  );
}

function RoundButton({
  icon,
  label,
  badge,
  caption,
  destructive,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  /** Visible word under the button; icons alone left Finish and Discard to guesswork. */
  caption?: string;
  destructive?: boolean;
  onPress(): void;
}) {
  const theme = useTheme();
  const tint = destructive ? theme.dangerText : theme.text;
  const button = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Ionicons name={icon} size={24} color={tint} />
      {badge ? (
        <ThemedText type="caption" style={styles.badge}>
          {badge}
        </ThemedText>
      ) : null}
    </Pressable>
  );
  if (!caption) return button;
  return (
    <View style={styles.captioned}>
      {button}
      <ThemedText type="caption" style={{ color: tint }}>
        {caption}
      </ThemedText>
    </View>
  );
}

interface RecordControlsProps {
  recording: boolean;
  lapCount: number;
  /** Offer the Lap button; the athlete can turn lap tracking off. */
  showLap?: boolean;
  onPause(): void;
  onResume(): void;
  onLap(): void;
  onFinish(): void;
  /** Throws the paused run away; the screen asks first. */
  onDiscard(): void;
}

/** Pause and lap while recording; resume, finish or discard once paused. Finishing never asks twice. */
export function RecordControls({
  recording,
  lapCount,
  showLap = true,
  onPause,
  onResume,
  onLap,
  onFinish,
  onDiscard,
}: RecordControlsProps) {
  return (
    <View style={styles.row}>
      {recording ? (
        <>
          <PillButton icon="pause" label="Pause activity" caption="Pause" onPress={onPause} />
          {showLap && (
            <RoundButton
              icon="flag"
              label={`Mark a lap. ${lapCount} so far`}
              badge={lapCount}
              onPress={onLap}
            />
          )}
        </>
      ) : (
        <>
          <PillButton icon="play" label="Resume activity" caption="Resume" onPress={onResume} />
          <RoundButton
            icon="checkmark"
            label="Finish activity"
            caption="Finish"
            onPress={onFinish}
          />
          <RoundButton
            icon="trash-outline"
            label="Discard activity"
            caption="Discard"
            destructive
            onPress={onDiscard}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  pill: {
    flex: 1,
    height: BUTTON_SIZE,
    borderRadius: BorderRadius.full,
    backgroundColor: Brand.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  pillCaption: { color: Palette.white },
  round: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captioned: { alignItems: 'center', gap: Spacing.one },
  badge: { position: 'absolute', bottom: Spacing.two },
});
