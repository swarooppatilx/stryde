import { Ionicons } from '@expo/vector-icons';
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
import { CLUB_DESCRIPTION_MAX, CLUB_LOCATION_MAX, CLUB_NAME_MAX } from '@/constants/limits';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useChainAction } from '@/hooks/useChainAction';
import { useDiscardGuard } from '@/hooks/useDiscardGuard';
import { useGoBack } from '@/hooks/useGoBack';
import { sportTypeToOnchain, useCommunityStore } from '@/stores/communityStore';
import type { ActivityType } from '@/types';
import { Alert } from '@/utils/alert';
import { haptics } from '@/utils/haptics';

export default function CreateClubScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const theme = useTheme();
  const { address, run } = useChainAction();
  const fetchClubs = useCommunityStore((s) => s.fetchClubs);
  const fetchJoinedClubs = useCommunityStore((s) => s.fetchJoinedClubs);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const { allowLeave } = useDiscardGuard(
    name.trim() !== '' || location.trim() !== '' || description.trim() !== ''
  );
  const [sportType, setSportType] = useState<ActivityType>('run');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your club a name.');
      return;
    }

    haptics.impactMedium();
    setIsSubmitting(true);
    try {
      const result = await run(
        (wallet) =>
          services.group.createGroup(wallet, {
            name: name.trim(),
            location: location.trim(),
            description: description.trim(),
            sportType: sportTypeToOnchain(sportType),
          }),
        { pending: 'Creating club...', success: 'Club created' }
      );
      if (!result?.confirmed || !address) return;

      await Promise.all([fetchClubs(), fetchJoinedClubs(address)]);
      allowLeave();
      router.replace({
        pathname: '/clubs/[id]',
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
          <Tappable
            onPress={goBack}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Tappable>
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
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Club name
            </ThemedText>
            <TextField
              value={name}
              onChangeText={setName}
              placeholder="e.g. Pune Trail Runners"
              maxLength={CLUB_NAME_MAX}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Location
            </ThemedText>
            <TextField
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Pune, India"
              maxLength={CLUB_LOCATION_MAX}
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Description
            </ThemedText>
            <TextField
              value={description}
              onChangeText={setDescription}
              placeholder="What's this club about?"
              maxLength={CLUB_DESCRIPTION_MAX}
              multiline
            />
          </ThemedView>

          <SportField value={sportType} onChange={setSportType} />

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
  submitBtn: {
    marginTop: Spacing.two,
    borderRadius: BorderRadius.full,
  },
});
