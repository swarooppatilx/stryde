import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { SportField } from '@/components/sport-field';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EVENT_DESCRIPTION_MAX, EVENT_TITLE_MAX, NUMBER_INPUT_MAX } from '@/constants/limits';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useChainAction } from '@/hooks/useChainAction';
import { useDiscardGuard } from '@/hooks/useDiscardGuard';
import { useGoBack } from '@/hooks/useGoBack';
import { sportTypeToOnchain, useCommunityStore } from '@/stores/communityStore';
import type { ActivityType } from '@/types';
import { Alert } from '@/utils/alert';
import { formatWeekdayDay } from '@/utils/dates';
import { distanceUnitLabel, parseDistanceMeters } from '@/utils/distanceUnits';
import { eventBlocker } from '@/utils/eventBlocker';
import { haptics } from '@/utils/haptics';

const DAY_MS = 86_400_000;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return formatWeekdayDay(d);
}

export default function CreateEventScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const theme = useTheme();
  const { wallet, address, run } = useChainAction();
  const upsertEvent = useCommunityStore((s) => s.upsertEvent);
  const removeEvent = useCommunityStore((s) => s.removeEvent);
  const applyEventJoin = useCommunityStore((s) => s.applyEventJoin);
  const fetchEvents = useCommunityStore((s) => s.fetchEvents);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sportType, setSportType] = useState<ActivityType>('run');
  const [startDate, setStartDate] = useState(startOfToday);
  const [endDate, setEndDate] = useState(() => new Date(startOfToday().getTime() + 7 * DAY_MS));
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);
  const unitSystem = useUnitSystem();
  const [distanceInput, setDistanceInput] = useState('');
  const { allowLeave } = useDiscardGuard(
    title.trim() !== '' || description.trim() !== '' || distanceInput !== ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const distanceMeters = parseDistanceMeters(distanceInput, unitSystem);
  const datesValid = endDate.getTime() > startDate.getTime();
  const blocker = eventBlocker({
    title,
    datesValid,
    distanceMeters,
    hasWallet: !!wallet,
  });
  const canSubmit = blocker === null && !isSubmitting;

  const onDateChange = (_e: unknown, selected?: Date) => {
    const which = picking;
    setPicking(Platform.OS === 'ios' ? which : null);
    if (!selected || !which) return;
    if (which === 'start') {
      setStartDate(selected);
      if (endDate.getTime() <= selected.getTime()) {
        setEndDate(new Date(selected.getTime() + DAY_MS));
      }
    } else {
      // End of the chosen day, so a same-day event still has a positive span.
      const end = new Date(selected);
      end.setHours(23, 59, 59, 0);
      setEndDate(end);
    }
  };

  const handleSubmit = async () => {
    // The submit button stays disabled until the wallet is connected.
    if (!address) return;
    if (!title.trim()) {
      Alert.alert('Title required', 'Give your event a title.');
      return;
    }
    if (!datesValid) {
      Alert.alert('Check the dates', 'The event has to end after it starts.');
      return;
    }

    haptics.impactMedium();
    setIsSubmitting(true);
    const pendingId = `pending-${Date.now()}`;
    try {
      const result = await run(
        (wallet) =>
          services.event.createEvent(wallet, {
            title: title.trim(),
            description: description.trim(),
            sportType: sportTypeToOnchain(sportType),
            startTime: Math.floor(startDate.getTime() / 1000),
            endTime: Math.floor(endDate.getTime() / 1000),
            distanceGoal: distanceMeters,
          }),
        { pending: 'Creating event...', success: 'Event created' },
        {
          // Show it in the Events list right away; swapped for the real
          // on-chain event (or removed) once the tx settles.
          apply: () => {
            upsertEvent({
              id: pendingId,
              title: title.trim(),
              description: description.trim(),
              sportType,
              startDate,
              endDate,
              distanceGoal: distanceMeters,
              participantCount: 1,
              host: address,
            });
            applyEventJoin(pendingId, true);
          },
          revert: () => {
            applyEventJoin(pendingId, false);
            removeEvent(pendingId);
          },
        }
      );
      if (!result?.confirmed) return;

      const eventId = result.eventId.toString();
      applyEventJoin(pendingId, false);
      removeEvent(pendingId);
      applyEventJoin(eventId, true);
      await fetchEvents();
      allowLeave();
      router.replace({ pathname: '/events/[id]', params: { id: eventId } });
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickerValue = picking === 'end' ? endDate : startDate;

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView style={[styles.header, { borderBottomColor: theme.border }]}>
          <Tappable
            onPress={goBack}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle">New Event</ThemedText>
          <View style={styles.headerBtn} />
        </ThemedView>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Title
            </ThemedText>
            <TextField
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. October 50K"
              maxLength={EVENT_TITLE_MAX}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Description
            </ThemedText>
            <TextField
              value={description}
              onChangeText={setDescription}
              placeholder="What's the goal?"
              maxLength={EVENT_DESCRIPTION_MAX}
              multiline
            />
          </ThemedView>

          <SportField value={sportType} onChange={setSportType} />

          <View style={styles.dateRow}>
            {(['start', 'end'] as const).map((which) => (
              <ThemedView key={which} style={[styles.field, styles.dateField]}>
                <ThemedText type="eyebrow" themeColor="textSecondary">
                  {which === 'start' ? 'Starts' : 'Ends'}
                </ThemedText>
                <Tappable
                  style={[
                    styles.selector,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    haptics.tap();
                    setPicking(which);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={which === 'start' ? 'Pick start date' : 'Pick end date'}
                >
                  <ThemedText type="smallBold">
                    {formatDate(which === 'start' ? startDate : endDate)}
                  </ThemedText>
                  <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
                </Tappable>
              </ThemedView>
            ))}
          </View>
          {picking && (
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={onDateChange}
              onDismiss={() => setPicking(null)}
              minimumDate={picking === 'end' ? startDate : startOfToday()}
            />
          )}

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              {`Distance goal (${distanceUnitLabel(unitSystem)})`}
            </ThemedText>
            <TextField
              value={distanceInput}
              onChangeText={(t) => setDistanceInput(t.replace(/[^0-9.]/g, ''))}
              placeholder="e.g. 50"
              maxLength={NUMBER_INPUT_MAX}
              keyboardType="decimal-pad"
            />
          </ThemedView>

          {blocker && title.trim() !== '' && (
            <ThemedText type="caption" themeColor="textSecondary">
              {blocker}
            </ThemedText>
          )}
          <AppButton onPress={handleSubmit} disabled={!canSubmit} style={styles.submitBtn}>
            {isSubmitting ? 'Creating...' : 'Create Event'}
          </AppButton>

          <View style={{ height: Spacing.five }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 0 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.two,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  dateField: {
    flex: 1,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  submitBtn: {
    marginTop: Spacing.two,
    borderRadius: BorderRadius.full,
  },
});
