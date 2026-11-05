import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BirthdayField } from '@/components/birthday-field';
import { AppButton } from '@/components/button';
import { GenderPicker } from '@/components/gender-picker';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PERSON_NAME_MAX } from '@/constants/limits';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useAboutSave } from '@/hooks/useAboutSave';
import { useAuth } from '@/hooks/useAuth';
import { useDiscardGuard } from '@/hooks/useDiscardGuard';
import { useGoBack } from '@/hooks/useGoBack';
import { saveWeight } from '@/services/bodyProfile';
import { updatePrivyMetadata } from '@/services/profileService';
import { useProfileStore } from '@/stores/profileStore';
import type { Gender } from '@/types';
import { MIN_AGE, meetsMinimumAge } from '@/utils/age';
import { formatWeight, parseWeightKg, weightRangeText } from '@/utils/calories';
import { parseCalendarDay, toCalendarDay } from '@/utils/dates';
import { logger } from '@/utils/logger';

export default function ProfileEditScreen() {
  const goBack = useGoBack();
  const theme = useTheme();
  const { user } = useAuth();

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
    storedBirthday ? parseCalendarDay(storedBirthday) : null
  );
  const unitSystem = useUnitSystem();
  const storedWeightKg = useProfileStore((s) => s.settings.weightKg);
  const _updateSettings = useProfileStore((s) => s.updateSettings);
  const [weight, setWeight] = useState(
    storedWeightKg ? formatWeight(storedWeightKg, unitSystem) : ''
  );
  const storedBio = useProfileStore((s) => s.bio);
  const storedLocation = useProfileStore((s) => s.location);
  const saveAbout = useAboutSave();
  const [bio, setBio] = useState(storedBio);
  const [location, setLocation] = useState(storedLocation);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const enteredWeightKg = parseWeightKg(weight, unitSystem);
  const weightBlank = weight.trim() === '';
  const weightInvalid = !weightBlank && enteredWeightKg === null;
  const weightChanged = weightBlank
    ? storedWeightKg !== undefined
    : enteredWeightKg !== null && enteredWeightKg !== storedWeightKg;
  const hasChanges =
    firstName.trim() !== storedFirstName ||
    lastName.trim() !== storedLastName ||
    gender !== storedGender ||
    (birthday ? toCalendarDay(birthday) : null) !== storedBirthday ||
    bio.trim() !== storedBio ||
    location.trim() !== storedLocation ||
    weightChanged;

  const { allowLeave } = useDiscardGuard(hasChanges);

  const handleSave = async () => {
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (birthday && !meetsMinimumAge(birthday, new Date())) {
      setError(`You need to be at least ${MIN_AGE} to use Stryde.`);
      return;
    }
    if (weightInvalid) {
      setError(`Enter a weight ${weightRangeText(unitSystem)}`);
      return;
    }
    setSaving(true);
    let about: Awaited<ReturnType<typeof saveAbout>>;
    try {
      about = await saveAbout({ bio, location });
    } catch (e) {
      logger.warn('[ProfileEdit] Saving about failed', e);
      setSaving(false);
      setError("Couldn't save your profile. Try again.");
      return;
    }
    if (!about.ok) {
      setSaving(false);
      setError(about.error);
      return;
    }
    setError(null);
    saveWeight(enteredWeightKg);
    saveFirstName(firstName.trim());
    saveLastName(lastName.trim());
    saveGender(gender);
    if (birthday) {
      saveBirthday(toCalendarDay(birthday));
    }
    if (user?.kind === 'privy') {
      updatePrivyMetadata(user.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      }).catch((err) => {
        logger.warn('[ProfileEdit] Failed to sync to Privy', err);
      });
    }
    allowLeave();
    goBack();
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.topBar}>
          <Tappable
            onPress={goBack}
            hitSlop={12}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle">Edit Profile</ThemedText>
          <View style={styles.backButton} />
        </ThemedView>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            <ThemedText type="eyebrow" style={[styles.label, { color: theme.textSecondary }]}>
              Name
            </ThemedText>
            <TextField
              placeholder="First name"
              maxLength={PERSON_NAME_MAX}
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
              maxLength={PERSON_NAME_MAX}
              value={lastName}
              onChangeText={setLastName}
              autoCorrect={false}
            />

            <ThemedText
              type="eyebrow"
              style={[styles.label, { color: theme.textSecondary, marginTop: Spacing.three }]}
            >
              About
            </ThemedText>
            <TextField
              placeholder="Bio (optional)"
              value={bio}
              // One paragraph: line breaks would be refused, so they become spaces as you type.
              onChangeText={(t) => setBio(t.replace(/[\r\n]+/g, ' '))}
              maxLength={services.profileAbout.MAX_BIO_LENGTH}
              multiline
              error={error?.startsWith('Bio') ? error : null}
            />
            <TextField
              placeholder="Location (optional)"
              value={location}
              onChangeText={(t) => setLocation(t.replace(/[\r\n]+/g, ' '))}
              maxLength={services.profileAbout.MAX_LOCATION_LENGTH}
              error={error?.startsWith('Location') ? error : null}
            />

            <ThemedText
              type="eyebrow"
              style={[styles.label, { color: theme.textSecondary, marginTop: Spacing.three }]}
            >
              Birthday
            </ThemedText>
            <BirthdayField value={birthday} onChange={setBirthday} />

            <ThemedText
              type="eyebrow"
              style={[styles.label, { color: theme.textSecondary, marginTop: Spacing.three }]}
            >
              Gender
            </ThemedText>
            <GenderPicker selected={gender} onSelect={setGender} />

            <ThemedText
              type="eyebrow"
              style={[styles.label, { color: theme.textSecondary, marginTop: Spacing.three }]}
            >
              {`Weight (${unitSystem === 'imperial' ? 'lb' : 'kg'})`}
            </ThemedText>
            <TextField
              placeholder="Optional, used for calories"
              value={weight}
              onChangeText={(t) => {
                setWeight(t);
                setError(null);
              }}
              keyboardType="decimal-pad"
              error={error && weightInvalid ? error : null}
            />

            <AppButton
              onPress={handleSave}
              disabled={!hasChanges}
              loading={saving}
              style={styles.saveButton}
            >
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },
  form: {
    gap: Spacing.two,
  },
  label: {
    marginBottom: Spacing.one,
  },
  saveButton: {
    borderRadius: BorderRadius.full,
    marginTop: Spacing.four,
  },
});
