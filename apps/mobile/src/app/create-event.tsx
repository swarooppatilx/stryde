import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { SportTypePicker } from '@/components/sport-type-picker';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ENV } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTransactor } from '@/hooks/useTransactor';
import { useViemWallet } from '@/hooks/useViemWallet';
import { sportTypeToOnchain, useCommunityStore } from '@/stores/communityStore';
import type { ActivityType } from '@/types';
import { Alert } from '@/utils/alert';
import { haptics } from '@/utils/haptics';

const DAY_MS = 86_400_000;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function CreateEventScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { wallet, address } = useViemWallet(ENV.CHAIN_MODE);
  const { transact } = useTransactor();
  const upsertEvent = useCommunityStore((s) => s.upsertEvent);
  const removeEvent = useCommunityStore((s) => s.removeEvent);
  const applyEventJoin = useCommunityStore((s) => s.applyEventJoin);
  const fetchEvents = useCommunityStore((s) => s.fetchEvents);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sportType, setSportType] = useState<ActivityType>('run');
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [startDate, setStartDate] = useState(startOfToday);
  const [endDate, setEndDate] = useState(() => new Date(startOfToday().getTime() + 7 * DAY_MS));
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);
  const [distanceKm, setDistanceKm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const distanceMeters = Math.round(Number.parseFloat(distanceKm || '0') * 1000);
  const datesValid = endDate.getTime() > startDate.getTime();
  const canSubmit =
    title.trim().length > 0 && datesValid && distanceMeters > 0 && !isSubmitting && !!wallet;

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
    if (!wallet || !address) return;
    if (!title.trim()) {
      Alert.alert('Title required', 'Give your event a title.');
      return;
    }
    if (!datesValid) {
      Alert.alert('Check the dates', 'The event has to end after it starts.');
      return;
    }

    haptics.success();
    setIsSubmitting(true);
    const pendingId = `pending-${Date.now()}`;
    try {
      const result = await transact(
        () =>
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
      router.replace({ pathname: '/event-detail', params: { id: eventId } });
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickerValue = picking === 'end' ? endDate : startDate;

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="sectionTitle">New Event</ThemedText>
          <View style={styles.headerBtn} />
        </ThemedView>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Title
            </ThemedText>
            <TextField value={title} onChangeText={setTitle} placeholder="e.g. October 50K" />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Description
            </ThemedText>
            <TextField
              value={description}
              onChangeText={setDescription}
              placeholder="What's the goal?"
              multiline
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Sport
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.selector,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
              activeOpacity={0.7}
              onPress={() => {
                haptics.tap();
                setShowSportPicker(!showSportPicker);
              }}
            >
              <ThemedText type="smallBold">
                {sportType.charAt(0).toUpperCase() + sportType.slice(1)}
              </ThemedText>
              <Ionicons
                name={showSportPicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
            {showSportPicker && (
              <SportTypePicker
                selected={sportType}
                onSelect={(type) => {
                  setSportType(type);
                  setShowSportPicker(false);
                }}
              />
            )}
          </ThemedView>

          <View style={styles.dateRow}>
            {(['start', 'end'] as const).map((which) => (
              <ThemedView key={which} style={[styles.field, styles.dateField]}>
                <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
                  {which === 'start' ? 'Starts' : 'Ends'}
                </ThemedText>
                <TouchableOpacity
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
                </TouchableOpacity>
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
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Distance goal (km)
            </ThemedText>
            <TextField
              value={distanceKm}
              onChangeText={(t) => setDistanceKm(t.replace(/[^0-9.]/g, ''))}
              placeholder="e.g. 50"
              keyboardType="decimal-pad"
            />
          </ThemedView>

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
