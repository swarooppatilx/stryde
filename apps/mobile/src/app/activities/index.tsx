import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityBulkBar } from '@/components/activity-bulk-bar';
import { ActivityPickRow } from '@/components/activity-pick-row';
import { ChipRow } from '@/components/filter-chips';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useGoBack } from '@/hooks/useGoBack';
import { deleteActivity } from '@/services/activityDeletion';
import { useActivityStore } from '@/stores/activityStore';
import type { ActivityPrivacy, ActivityType } from '@/types';
import {
  alreadyPublicCount,
  DATE_RANGES,
  type DateRange,
  filterActivities,
  needsPrivacyChange,
  toggleId,
} from '@/utils/activityList';
import { confirmDestructive } from '@/utils/confirmDestructive';
import { confirmOnlyMe } from '@/utils/confirmOnlyMe';
import { SPORT_LABEL } from '@/utils/format';
import { sportsDone } from '@/utils/periodStats';
import { countOf } from '@/utils/plural';
import { Toast } from '@/utils/toast';

/** Every activity, searchable by title and filterable by sport and date, with bulk privacy and delete. */
export default function ActivitiesScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const activities = useActivityStore((s) => s.activities);
  const updateActivity = useActivityStore((s) => s.updateActivity);

  const [query, setQuery] = useState('');
  const [sportChoice, setSportChoice] = useState<ActivityType | 'all'>('all');
  const [range, setRange] = useState<DateRange>('all');
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const sports = sportsDone(activities);
  // A sport with no activities left (all deleted) falls back to everything.
  const sport = sports.includes(sportChoice as ActivityType) ? sportChoice : 'all';
  const visible = filterActivities(activities, { query, sport, range }, new Date());
  const sportOptions = [
    { value: 'all' as const, label: 'All' },
    ...sports.map((type) => ({ value: type, label: SPORT_LABEL[type] ?? type })),
  ];
  // Rows filtered out of view are never acted on.
  const chosen = picked.filter((id) => visible.some((a) => a.id === id));

  const stopSelecting = () => {
    setSelecting(false);
    setPicked([]);
  };

  const open = (id: string) => {
    if (selecting) setPicked((ids) => toggleId(ids, id));
    else router.push(`/activities/${id}`);
  };

  const changePrivacy = (privacy: ActivityPrivacy) => {
    const ids = needsPrivacyChange(activities, chosen, privacy);
    if (ids.length === 0) {
      Toast.info('Already set that way', 1.5);
      return;
    }
    const apply = () => {
      for (const id of ids) updateActivity(id, { privacy });
      Toast.success(`Updated ${countOf(ids.length, 'activity', 'activities')}`, 1.5);
      stopSelecting();
    };
    if (privacy === 'only_me') confirmOnlyMe(apply, alreadyPublicCount(activities, ids));
    else apply();
  };

  const removePicked = () => {
    const count = countOf(chosen.length, 'activity', 'activities');
    confirmDestructive({
      title: `Delete ${count}?`,
      message:
        'They are removed from this phone. A copy already in the public record stays there and cannot be erased.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        for (const id of chosen) deleteActivity(id);
        Toast.info(`Deleted ${count}`, 1.5);
        stopSelecting();
      },
    });
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Tappable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle">Activities</ThemedText>
          <Tappable
            onPress={() => (selecting ? stopSelecting() : setSelecting(true))}
            disabled={activities.length === 0}
            hitSlop={12}
            accessibilityRole="button"
          >
            <ThemedText type="smallBold" themeColor="accentText">
              {selecting ? 'Done' : 'Select'}
            </ThemedText>
          </Tappable>
        </View>
        <View style={styles.filters}>
          <TextField
            placeholder="Search by title"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {sports.length > 1 && (
            <ChipRow options={sportOptions} value={sport} onChange={setSportChoice} />
          )}
          <ChipRow options={DATE_RANGES} value={range} onChange={setRange} />
          <ThemedText type="caption" themeColor="textSecondary">
            {countOf(visible.length, 'activity', 'activities')}
            {selecting ? ' · tap to pick' : ' · hold one to pick several'}
          </ThemedText>
        </View>
        <FlatList
          data={visible}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={Gap}
          renderItem={({ item }) => (
            <ActivityPickRow
              activity={item}
              unitSystem={unitSystem}
              selecting={selecting}
              selected={chosen.includes(item.id)}
              onPress={() => open(item.id)}
              onLongPress={() => {
                setSelecting(true);
                setPicked((ids) => (ids.includes(item.id) ? ids : [...ids, item.id]));
              }}
            />
          )}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {activities.length === 0
                ? 'No activities yet.'
                : 'Nothing matches. Try another search or a wider date range.'}
            </ThemedText>
          }
        />
        {selecting && chosen.length > 0 && (
          <ActivityBulkBar
            count={chosen.length}
            onPrivacy={changePrivacy}
            onDelete={removePicked}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  filters: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.one },
  list: { padding: Spacing.four },
  gap: { height: Spacing.two },
  empty: { textAlign: 'center', paddingVertical: Spacing.five },
});
