import { Segmented } from '@/components/form-controls';
import { SettingsScreen } from '@/components/settings-screen';
import { ThemedText } from '@/components/themed-text';
import { WeeklyGoalsSettings } from '@/components/weekly-goals-settings';
import { Spacing } from '@/constants/theme';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { MOTION_OPTIONS } from '@/utils/motionPreference';
import { THEME_PREF_LABEL } from '@/utils/settingsSummary';
import { START_TABS } from '@/utils/startTab';
import { WEEK_START_OPTIONS } from '@/utils/trainingLog';

const THEME_OPTIONS = (['system', 'light', 'dark'] as const).map((value) => ({
  value,
  label: THEME_PREF_LABEL[value],
}));

function Heading({ children }: { children: string }) {
  return (
    <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
      {children}
    </ThemedText>
  );
}

export default function PreferencesScreen() {
  const theme = useProfileStore((s) => s.settings.theme);
  const units = useProfileStore((s) => s.settings.units);
  const updateSettings = useProfileStore((s) => s.updateSettings);
  const startTab = useSettingsStore((s) => s.startTab);
  const setStartTab = useSettingsStore((s) => s.setStartTab);
  const weekStartsOn = useSettingsStore((s) => s.weekStartsOn);
  const setWeekStartsOn = useSettingsStore((s) => s.setWeekStartsOn);
  const motion = useSettingsStore((s) => s.motion);
  const setMotion = useSettingsStore((s) => s.setMotion);

  return (
    <SettingsScreen title="Preferences">
      <Heading>THEME</Heading>
      <Segmented
        label="Theme"
        value={theme}
        options={THEME_OPTIONS}
        onChange={(next) => updateSettings({ theme: next })}
      />

      <Heading>UNITS</Heading>
      <Segmented
        label="Units"
        value={units}
        options={[
          { value: 'metric', label: 'Metric (km)' },
          { value: 'imperial', label: 'Imperial (mi)' },
        ]}
        onChange={(unit) => updateSettings({ units: unit })}
      />

      <Heading>WEEK STARTS ON</Heading>
      <Segmented
        label="Week starts on"
        value={weekStartsOn}
        options={WEEK_START_OPTIONS}
        onChange={setWeekStartsOn}
      />

      <Heading>OPEN THE APP ON</Heading>
      <Segmented
        label="Open the app on"
        value={startTab}
        options={START_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
        onChange={setStartTab}
      />

      <Heading>MOTION</Heading>
      <Segmented
        label="Motion"
        value={motion}
        options={MOTION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        onChange={setMotion}
      />
      <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: -Spacing.one }}>
        Auto follows your phone's reduce-motion setting. Reduced keeps screen changes and loading
        placeholders still.
      </ThemedText>

      <WeeklyGoalsSettings />
    </SettingsScreen>
  );
}
