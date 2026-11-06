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
import { useT } from '@/i18n';
import { formatDateTime } from '@/utils/dates';
import { formatRelativeTime } from '@/utils/format';
import { describeImport } from '@/utils/healthImportMessage';

/** Bring workouts recorded by a watch or another app into Stryde, from the phone's health data. */
export default function HealthImportScreen() {
  const t = useT();
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
            ? t('healthImport.updateNeeded')
            : t('healthImport.notAvailable')}
        </ThemedText>
      );
    }
    if (hasAccess) {
      return (
        <AppButton loading={importing} onPress={() => void importNow()}>
          {t('healthImport.importNow')}
        </AppButton>
      );
    }
    return (
      <AppButton disabled={status === 'checking'} onPress={() => void connect()}>
        {t('healthImport.allow')}
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
            accessibilityLabel={t('healthImport.back')}
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle">{t('healthImport.title')}</ThemedText>
          <View style={styles.spacer} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText themeColor="textSecondary">{t('healthImport.intro')}</ThemedText>

          {action()}

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <ThemedText type="smallBold">{t('healthImport.autoSync')}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {t('healthImport.autoSyncHint')}
              </ThemedText>
            </View>
            <AppSwitch
              checked={autoSync}
              onChange={(on) => void setAutoSync(on)}
              label={t('healthImport.autoSync')}
              disabled={unavailable || status === 'checking'}
            />
          </View>
          {notInstalled && autoSync && (
            <ThemedText type="caption" themeColor="warningText">
              {t('healthImport.unavailableNow')}
            </ThemedText>
          )}
          {autoSync && lastAutoSync && (
            <ThemedText type="caption" themeColor="textSecondary">
              {t('healthImport.lastChecked', {
                ago: formatRelativeTime(new Date(lastAutoSync.at)),
                found:
                  lastAutoSync.imported === 0
                    ? t('healthImport.noNew')
                    : t('healthImport.newWorkouts', { count: lastAutoSync.imported }),
              })}
            </ThemedText>
          )}

          {result && <ThemedText type="smallBold">{describeImport(result, t)}</ThemedText>}
          {lastImportAt !== null && (
            <ThemedText type="caption" themeColor="textSecondary">
              {t('healthImport.lastImported', { when: formatDateTime(lastImportAt) })}
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
