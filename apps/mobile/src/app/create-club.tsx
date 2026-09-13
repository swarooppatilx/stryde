import { Ionicons } from '@expo/vector-icons';
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

export default function CreateClubScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { wallet, address } = useViemWallet(ENV.CHAIN_MODE);
  const { transact } = useTransactor();
  const fetchClubs = useCommunityStore((s) => s.fetchClubs);
  const fetchJoinedClubs = useCommunityStore((s) => s.fetchJoinedClubs);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [sportType, setSportType] = useState<ActivityType>('run');
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!wallet || !address) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your club a name.');
      return;
    }

    haptics.success();
    setIsSubmitting(true);
    try {
      const result = await transact(
        () =>
          services.group.createGroup(wallet, {
            name: name.trim(),
            location: location.trim(),
            description: description.trim(),
            sportType: sportTypeToOnchain(sportType),
          }),
        { pending: 'Creating club...', success: 'Club created' }
      );
      if (!result?.confirmed) return;

      await Promise.all([fetchClubs(), fetchJoinedClubs(address)]);
      router.replace({
        pathname: '/club-detail',
        params: { id: result.groupId.toString() },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <ThemedText type="sectionTitle">New Club</ThemedText>
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
              Club name
            </ThemedText>
            <TextField value={name} onChangeText={setName} placeholder="e.g. Pune Trail Runners" />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Location
            </ThemedText>
            <TextField value={location} onChangeText={setLocation} placeholder="e.g. Pune, India" />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Description
            </ThemedText>
            <TextField
              value={description}
              onChangeText={setDescription}
              placeholder="What's this club about?"
              multiline
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Sport
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.sportSelector,
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

          <AppButton onPress={handleSubmit} disabled={!canSubmit} style={styles.submitBtn}>
            {isSubmitting ? 'Creating...' : 'Create Club'}
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
  sportSelector: {
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
