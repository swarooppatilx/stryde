import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { DayField } from '@/components/day-field';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GPS_DISTANCE_SPORTS } from '@/constants/activity';
import { NUMBER_INPUT_MAX } from '@/constants/limits';
import { BorderRadius, IconSize, Spacing, Touch } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SaveActivityForm } from '@/hooks/useSaveActivityForm';
import { formatTimeOfDay } from '@/utils/dates';
import { formatPaceOrSpeed } from '@/utils/format';
import { FieldBlock } from './field-block';

/** Distance, duration, day and start time for an activity that was typed in rather than recorded. */
export function ManualEntrySection({ form }: { form: SaveActivityForm }) {
  const theme = useTheme();
  const { manual, unitSystem, activityType } = form;
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const setTime = (time: Date | undefined) => {
    setTimePickerOpen(Platform.OS === 'ios');
    if (!time) return;
    manual.setDay((current) => {
      const next = new Date(current);
      next.setHours(time.getHours(), time.getMinutes(), 0, 0);
      return next;
    });
  };

  return (
    <>
      <View style={styles.row}>
        <View style={styles.half}>
          <FieldBlock
            label={`Distance (${unitSystem === 'imperial' ? 'mi' : 'km'})${
              GPS_DISTANCE_SPORTS.has(activityType) ? '' : ' (optional)'
            }`}
          >
            <TextField
              value={manual.distanceInput}
              onChangeText={(t) => manual.setDistanceInput(t.replace(/[^0-9.,]/g, ''))}
              placeholder="e.g. 5"
              maxLength={NUMBER_INPUT_MAX}
              keyboardType="decimal-pad"
            />
          </FieldBlock>
        </View>
        <View style={styles.half}>
          <FieldBlock label="Duration (min or h:mm)">
            <TextField
              value={manual.minutesInput}
              onChangeText={(t) => manual.setMinutesInput(t.replace(/[^0-9.,:]/g, ''))}
              placeholder="e.g. 30 or 1:30"
              maxLength={NUMBER_INPUT_MAX}
              keyboardType="numbers-and-punctuation"
            />
          </FieldBlock>
        </View>
      </View>

      <FieldBlock label="When">
        <DayField
          label="Date of the activity"
          value={manual.day}
          onChange={(day) => {
            manual.setDay((current) => {
              const next = new Date(day);
              next.setHours(current.getHours(), current.getMinutes(), 0, 0);
              return next;
            });
          }}
          maximum={new Date()}
        />
        <ThemedView style={styles.timeField}>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            Start time
          </ThemedText>
          <Tappable
            style={[
              styles.timeButton,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
            onPress={() => setTimePickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Start time, ${formatTimeOfDay(manual.day)}`}
          >
            <ThemedText>{formatTimeOfDay(manual.day)}</ThemedText>
            <Ionicons name="time-outline" size={IconSize.inline} color={theme.textSecondary} />
          </Tappable>
          {manual.startInFuture && (
            <ThemedText type="small" style={{ color: theme.brand.danger }}>
              Start time must be in the past
            </ThemedText>
          )}
          {timePickerOpen && (
            <DateTimePicker
              value={manual.day}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={(_, time) => setTime(time)}
              onDismiss={() => setTimePickerOpen(false)}
            />
          )}
        </ThemedView>
      </FieldBlock>

      {!manual.entry.ok && manual.typedSomething && (
        <ThemedText type="small" style={{ color: theme.brand.danger }}>
          {manual.entry.reason}
        </ThemedText>
      )}
      {/* What the numbers add up to, so a mistyped minute or mile shows before it is saved. */}
      {manual.entry.ok && manual.entry.distance > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Works out to{' '}
          {formatPaceOrSpeed(
            activityType,
            manual.entry.distance,
            manual.entry.duration,
            unitSystem
          )}
        </ThemedText>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.three },
  half: { flex: 1 },
  timeField: { gap: Spacing.two },
  timeButton: {
    minHeight: Touch.target,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
});
