import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppSwitch } from '@/components/app-switch';
import { AppButton } from '@/components/button';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGoBack } from '@/hooks/useGoBack';
import { useHealthImport } from '@/hooks/useHealthImport';
import { describeAutoSync } from '@/services/healthSync';
import { formatDateTime } from '@/utils/dates';
import { formatRelativeTime } from '@/utils/format';
import { describeImport } from '@/utils/healthImportMessage';

/** Bring workouts recorded by a watch or another app into Stryde, from the phone's health data. */
export default function HealthImportScreen() {
  const goBack = useGoBack();
  const theme = useTheme();
  const {
    status,
    hasAccess,
    importing,
    result,
    lastImportAt,
    autoSync,
    lastAutoSync,
    setAutoSync,
    connect,
    importNow,
  } = useHealthImport();

  const unavailable = status === 'unavailable' || status === 'update-required';
  const notInstalled = status === 'unavailable';

  const action = () => {
    if (unavailable) {
      return (
        <ThemedText type="smallBold" themeColor="warningText">
          {status === 'update-required'
            ? 'Update Health Connect from the Play Store, then come back.'
            : 'Health Connect is not installed or not available on this phone, so there is nothing to import.'}
        </ThemedText>
      );
    }
    if (hasAccess) {
      return (
        <AppButton loading={importing} onPress={() => void importNow()}>
          Import now
        </AppButton>
      );
    }
    return (
      <AppButton disabled={status === 'checking'} onPress={() => void connect()}>
        Allow Stryde to read workouts
      </AppButton>
    );
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
          <ThemedText type="sectionTitle">Import workouts</ThemedText>
          <View style={styles.spacer} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText themeColor="textSecondary">
            Stryde can read the workouts your watch or other apps saved to Health Connect (running,
            cycling, walking, hiking and more) and add them to your activities. It only reads; it
            never writes to your health data. Imported workouts are saved on this device first and
            then recorded on-chain like any other activity.
          </ThemedText>

          {action()}

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <ThemedText type="smallBold">Sync automatically</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Checks for new workouts when you open the app.
              </ThemedText>
            </View>
            <AppSwitch
              checked={autoSync}
              onChange={(on) => void setAutoSync(on)}
              label="Sync automatically"
              disabled={unavailable || status === 'checking'}
            />
          </View>
          {notInstalled && autoSync && (
            <ThemedText type="caption" themeColor="warningText">
              Health Connect is unavailable right now, so nothing will be checked.
            </ThemedText>
          )}
          {autoSync && lastAutoSync && (
            <ThemedText type="caption" themeColor="textSecondary">
              {describeAutoSync(lastAutoSync, formatRelativeTime(new Date(lastAutoSync.at)))}
            </ThemedText>
          )}

          {result && <ThemedText type="smallBold">{describeImport(result)}</ThemedText>}
          {lastImportAt !== null && (
            <ThemedText type="caption" themeColor="textSecondary">
              Last imported {formatDateTime(lastImportAt)}
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
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
  spacer: { width: 24 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchText: { flex: 1, gap: Spacing.half },
  scroll: { padding: Spacing.four, gap: Spacing.three },
});
