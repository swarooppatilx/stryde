import { Ionicons } from '@expo/vector-icons';
import { usePrivy } from '@privy-io/expo';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { updatePrivyMetadata } from '@/services/profileService';
import { useProfileStore } from '@/stores/profileStore';
import type { Gender } from '@/types';

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: 'man', label: 'Man', icon: 'male' },
  { value: 'woman', label: 'Woman', icon: 'female' },
  { value: 'non_binary', label: 'Non-binary', icon: 'male-female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', icon: 'person' },
];

export default function ProfileEditScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = usePrivy();

  const storedFirstName = useProfileStore((s) => s.firstName);
  const storedLastName = useProfileStore((s) => s.lastName);
  const storedGender = useProfileStore((s) => s.gender);
  const storedBirthday = useProfileStore((s) => s.birthday);
  const saveFirstName = useProfileStore((s) => s.setFirstName);
  const saveLastName = useProfileStore((s) => s.setLastName);
  const saveGender = useProfileStore((s) => s.setGender);
  const saveBirthday = useProfileStore((s) => s.setBirthday);

  const [firstName, setFirstName] = useState(storedFirstName);
  const [lastName, setLastName] = useState(storedLastName);
  const [gender, setGender] = useState<Gender>(storedGender);
  const [birthday, setBirthday] = useState<Date | null>(
    storedBirthday ? new Date(storedBirthday) : null
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges =
    firstName.trim() !== storedFirstName ||
    lastName.trim() !== storedLastName ||
    gender !== storedGender ||
    birthday?.toISOString().split('T')[0] !== storedBirthday;

  const handleSave = () => {
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    setError(null);
    saveFirstName(firstName.trim());
    saveLastName(lastName.trim());
    saveGender(gender);
    if (birthday) {
      saveBirthday(birthday.toISOString().split('T')[0]);
    }
    if (user?.id) {
      updatePrivyMetadata(user.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      }).catch((err) => {
        console.warn('[ProfileEdit] Failed to sync to Privy', err);
      });
    }
    router.back();
  };

  const handleDateChange = (_event: unknown, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBirthday(selectedDate);
    }
  };

  const getMaxDate = () => {
    const now = new Date();
    now.setFullYear(now.getFullYear() - 13);
    return now;
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="sectionTitle">Edit Profile</ThemedText>
          <View style={styles.backButton} />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <ThemedText type="eyebrow" style={[styles.label, { color: theme.textSecondary }]}>
              Name
            </ThemedText>
            <TextField
              placeholder="First name"
              value={firstName}
              onChangeText={(t) => {
                setFirstName(t);
                setError(null);
              }}
              autoCorrect={false}
              error={error && !firstName.trim() ? error : null}
            />
            <TextField
              placeholder="Last name"
              value={lastName}
              onChangeText={setLastName}
              autoCorrect={false}
            />

            <ThemedText
              type="eyebrow"
              style={[styles.label, { color: theme.textSecondary, marginTop: Spacing.three }]}
            >
              Birthday
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.dateButton,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <ThemedText
                style={{ color: birthday ? theme.text : theme.textSecondary, fontSize: 16 }}
              >
                {birthday
                  ? birthday.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Select your birthday'}
              </ThemedText>
              <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={birthday || getMaxDate()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onValueChange={handleDateChange}
                onDismiss={() => setShowDatePicker(false)}
                maximumDate={getMaxDate()}
                minimumDate={new Date(1920, 0, 1)}
              />
            )}

            <ThemedText
              type="eyebrow"
              style={[styles.label, { color: theme.textSecondary, marginTop: Spacing.three }]}
            >
              Gender
            </ThemedText>
            <View style={styles.genderGrid}>
              {GENDER_OPTIONS.map((option) => {
                const selected = gender === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.genderCard,
                      {
                        backgroundColor: selected ? Brand.primary : theme.backgroundElement,
                        borderColor: selected ? Brand.primary : theme.border,
                      },
                    ]}
                    onPress={() => setGender(option.value)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={option.icon as keyof typeof Ionicons.glyphMap}
                      size={20}
                      color={selected ? Brand.white : theme.text}
                    />
                    <ThemedText
                      style={{
                        color: selected ? Brand.white : theme.text,
                        fontWeight: '600',
                        fontSize: 14,
                      }}
                    >
                      {option.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <AppButton onPress={handleSave} disabled={!hasChanges} style={styles.saveButton}>
              Save Changes
            </AppButton>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },
  form: {
    gap: Spacing.two,
  },
  label: {
    marginBottom: Spacing.one,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  genderGrid: {
    gap: Spacing.two,
  },
  genderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  saveButton: {
    borderRadius: BorderRadius.full,
    marginTop: Spacing.four,
  },
});
