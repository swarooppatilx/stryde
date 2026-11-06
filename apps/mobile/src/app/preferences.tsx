import { Segmented } from '@/components/form-controls';
import { SettingsScreen } from '@/components/settings-screen';
import { ThemedText } from '@/components/themed-text';
import { WeeklyGoalsSettings } from '@/components/weekly-goals-settings';
import { Spacing } from '@/constants/theme';
import { type LanguageSetting, type TKey, useT } from '@/i18n';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { languageLabel, themeLabel, weekStartLabel } from '@/utils/settingsSummary';
import { START_TABS } from '@/utils/startTab';

const LANGUAGE_VALUES: readonly LanguageSetting[] = ['system', 'en', 'hi'];

const TAB_KEY = {
  index: 'tabs.home',
  tracking: 'tabs.record',
  map: 'tabs.maps',
  groups: 'tabs.groups',
} as const satisfies Record<(typeof START_TABS)[number]['value'], TKey>;

function Heading({ children }: { children: string }) {
  return (
    <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
      {children}
    </ThemedText>
  );
}

export default function PreferencesScreen() {
  const t = useT();
  const theme = useProfileStore((s) => s.settings.theme);
  const units = useProfileStore((s) => s.settings.units);
  const updateSettings = useProfileStore((s) => s.updateSettings);
  const startTab = useSettingsStore((s) => s.startTab);
  const setStartTab = useSettingsStore((s) => s.setStartTab);
  const weekStartsOn = useSettingsStore((s) => s.weekStartsOn);
  const setWeekStartsOn = useSettingsStore((s) => s.setWeekStartsOn);
  const motion = useSettingsStore((s) => s.motion);
  const setMotion = useSettingsStore((s) => s.setMotion);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  return (
    <SettingsScreen title={t('preferences.title')}>
      <Heading>{t('preferences.themeHeading')}</Heading>
      <Segmented
        label={t('preferences.theme')}
        value={theme}
        options={(['system', 'light', 'dark'] as const).map((value) => ({
          value,
          label: themeLabel(value, t),
        }))}
        onChange={(next) => updateSettings({ theme: next })}
      />

      <Heading>{t('preferences.unitsHeading')}</Heading>
      <Segmented
        label={t('preferences.units')}
        value={units}
        options={[
          { value: 'metric', label: t('preferences.unitsMetric') },
          { value: 'imperial', label: t('preferences.unitsImperial') },
        ]}
        onChange={(unit) => updateSettings({ units: unit })}
      />

      <Heading>{t('preferences.weekStartsHeading')}</Heading>
      <Segmented
        label={t('preferences.weekStarts')}
        value={weekStartsOn}
        options={([0, 1] as const).map((value) => ({ value, label: weekStartLabel(value, t) }))}
        onChange={setWeekStartsOn}
      />

      <Heading>{t('preferences.openOnHeading')}</Heading>
      <Segmented
        label={t('preferences.openOn')}
        value={startTab}
        options={START_TABS.map((tab) => ({ value: tab.value, label: t(TAB_KEY[tab.value]) }))}
        onChange={setStartTab}
      />

      <Heading>{t('preferences.languageHeading')}</Heading>
      <Segmented
        label={t('preferences.language')}
        value={language}
        options={LANGUAGE_VALUES.map((value) => ({ value, label: languageLabel(value, t) }))}
        onChange={setLanguage}
      />

      <Heading>{t('preferences.motionHeading')}</Heading>
      <Segmented
        label={t('preferences.motion')}
        value={motion}
        options={[
          { value: 'auto', label: t('preferences.motionAuto') },
          { value: 'reduced', label: t('preferences.motionReduced') },
        ]}
        onChange={setMotion}
      />
      <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: -Spacing.one }}>
        {t('preferences.motionCaption')}
      </ThemedText>

      <WeeklyGoalsSettings />
    </SettingsScreen>
  );
}
