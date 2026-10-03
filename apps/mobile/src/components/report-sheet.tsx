import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import {
  MAX_REPORT_NOTE_LENGTH,
  REPORT_REASONS,
  type ReportReason,
  type ReportTarget,
  reportNoteProblem,
} from '@/utils/reporting';

const TITLES = {
  user: 'Report this athlete',
  activity: 'Report this activity',
  comment: 'Report this comment',
} as const;

interface ReportSheetProps {
  /** What is being reported; the sheet is open while this is set. */
  target: ReportTarget | null;
  onClose: () => void;
  onSubmit: (reason: ReportReason, note: string) => void;
}

/** Asks why something is being reported, with an optional few words, then hands both back. */
export function ReportSheet({ target, onClose, onSubmit }: ReportSheetProps) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');

  // A fresh sheet for each report, not the last answer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the target opening is the trigger
  useEffect(() => {
    setReason(null);
    setNote('');
  }, [target]);

  const problem = reportNoteProblem(note);

  return (
    <Modal
      visible={target !== null}
      transparent
      animationType="fade"
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
          {
            backgroundColor: theme.backgroundElement,
            paddingBottom: Math.max(bottom, Spacing.two) + keyboardHeight,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        <ThemedText type="sectionTitle">{target ? TITLES[target.kind] : ''}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Why are you reporting this? We will look into it and hide it for you now.
        </ThemedText>

        {REPORT_REASONS.map((option) => {
          const selected = reason === option.value;
          return (
            <Tappable
              key={option.value}
              style={styles.row}
              onPress={() => setReason(option.value)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
            >
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={selected ? theme.brand.primary : theme.textSecondary}
              />
              <ThemedText type="default">{option.label}</ThemedText>
            </Tappable>
          );
        })}

        <TextInput
          style={[
            styles.note,
            { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
          ]}
          placeholder="Add a few words (optional)"
          placeholderTextColor={theme.placeholder}
          accessibilityLabel="Add a few words (optional)"
          value={note}
          onChangeText={setNote}
          maxLength={MAX_REPORT_NOTE_LENGTH}
          returnKeyType="done"
        />
        {problem ? (
          <ThemedText type="caption" themeColor="dangerText">
            {problem}
          </ThemedText>
        ) : null}

        <AppButton
          disabled={!reason || problem !== null}
          onPress={() => {
            if (reason) onSubmit(reason, note);
          }}
        >
          Send report
        </AppButton>
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
    gap: Spacing.one,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
  },
  note: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 44,
    marginVertical: Spacing.two,
    ...textStyle(TypeScale.callout),
  },
});
