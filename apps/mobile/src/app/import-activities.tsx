import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SPORT_ICONS, getSportLabel as sportLabel } from '@/constants/activity';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useActivityFileImport } from '@/hooks/useActivityFileImport';
import { useGoBack } from '@/hooks/useGoBack';
import { useT } from '@/i18n';
import { formatDateTime } from '@/utils/dates';
import { formatDistance } from '@/utils/format';
import { describeFileImport } from '@/utils/importMessage';

/** Bring in activities saved as GPX, TCX or FIT files: choose them, review the list, keep what you want. */
export default function ImportActivitiesScreen() {
  const t = useT();
  const goBack = useGoBack();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const { items, errors, reading, importing, result, selectedCount, pick, toggle, importSelected } =
    useActivityFileImport();

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
          <ThemedText type="sectionTitle">{t('importFiles.title')}</ThemedText>
          <View style={styles.spacer} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText themeColor="textSecondary">{t('importFiles.intro')}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {t('importFiles.formatsAndPrivacy', {
              formats: t('importFiles.formats'),
              privacy: t('importFiles.privacy'),
            })}
          </ThemedText>

          <AppButton
            variant={items.length > 0 ? 'secondary' : 'primary'}
            loading={reading}
            disabled={importing}
            onPress={() => void pick()}
          >
            {items.length > 0 || result ? t('importFiles.chooseMore') : t('importFiles.choose')}
          </AppButton>

          {errors.map((message) => (
            <ThemedText key={message} type="small" themeColor="dangerText">
              {message}
            </ThemedText>
          ))}

          {items.map((item) => {
            const when = formatDateTime(item.input.startedAt ?? 0);
            const name = item.input.title || sportLabel(item.input.activityType, t);
            return (
              <Tappable
                key={item.id}
                onPress={() => toggle(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.selected }}
                accessibilityLabel={`${name}, ${when}, ${formatDistance(item.input.distance, unitSystem)}`}
                style={[
                  styles.row,
                  {
                    backgroundColor: item.selected
                      ? tint(theme.brand.primary, 0.12)
                      : theme.backgroundElement,
                    borderColor: item.selected ? theme.brand.primary : theme.border,
                  },
                ]}
              >
                <Ionicons
                  name={item.selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={item.selected ? theme.brand.primary : theme.textSecondary}
                />
                <View style={styles.info}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {name}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                    {sportLabel(item.input.activityType, t)} · {when} ·{' '}
                    {formatDistance(item.input.distance, unitSystem)}
                  </ThemedText>
                  {item.duplicate && (
                    <ThemedText type="caption" themeColor="warningText">
                      {t('importFiles.duplicate')}
                    </ThemedText>
                  )}
                </View>
                <Ionicons
                  name={SPORT_ICONS[item.input.activityType]}
                  size={20}
                  color={theme.textSecondary}
                />
              </Tappable>
            );
          })}

          {items.length > 0 && (
            <AppButton
              loading={importing}
              disabled={selectedCount === 0}
              onPress={() => void importSelected()}
            >
              {importing
                ? t('importFiles.importing')
                : t('importFiles.importCount', { count: selectedCount })}
            </AppButton>
          )}

          {result && <ThemedText type="smallBold">{describeFileImport(result, t)}</ThemedText>}
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
  scroll: { padding: Spacing.four, gap: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  info: { flex: 1, gap: Spacing.half },
});
