import { useRouter } from 'expo-router';
import { AppSwitch } from '@/components/app-switch';
import { ChipRow } from '@/components/filter-chips';
import { PrivacyPicker } from '@/components/privacy-picker';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useBlockStore } from '@/stores/blockStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  HIDDEN_STAT_CHOICES,
  type MapVisibility,
  mapVisibilityOf,
  switchesForMapVisibility,
} from '@/utils/privacyDefaults';
import { privateZonesSummary } from '@/utils/settingsSummary';

const VISIBILITY_OPTIONS: ReadonlyArray<{ value: MapVisibility; label: string }> = [
  { value: 'show', label: 'Show route' },
  { value: 'ends', label: 'Hide route ends' },
  { value: 'hide', label: 'Hide route' },
];

export default function PrivacySafetyScreen() {
  const router = useRouter();
  const defaultPrivacy = useSettingsStore((s) => s.defaultPrivacy);
  const setDefaultPrivacy = useSettingsStore((s) => s.setDefaultPrivacy);
  const hideRouteEnds = useSettingsStore((s) => s.hideRouteEnds);
  const setHideRouteEnds = useSettingsStore((s) => s.setHideRouteEnds);
  const defaultHideRoute = useSettingsStore((s) => s.defaultHideRoute);
  const defaultHiddenStats = useSettingsStore((s) => s.defaultHiddenStats);
  const setDefaultHiddenStat = useSettingsStore((s) => s.setDefaultHiddenStat);
  const defaultMuted = useSettingsStore((s) => s.defaultMutedFromFeeds);
  const setDefaultMuted = useSettingsStore((s) => s.setDefaultMutedFromFeeds);
  const mapVisibility = mapVisibilityOf({ defaultHideRoute, hideRouteEnds });
  const chooseMapVisibility = (choice: MapVisibility) => {
    const next = switchesForMapVisibility(choice);
    setHideRouteEnds(next.hideRouteEnds);
    useSettingsStore.getState().setDefaultHideRoute(next.defaultHideRoute);
  };
  const zoneCount = useSettingsStore((s) => s.privacyZones.length);
  const hiddenCount = useBlockStore((s) => s.blocked.length + s.muted.length);

  return (
    <SettingsScreen title="Privacy and safety">
      <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
        DEFAULT VISIBILITY
      </ThemedText>
      <PrivacyPicker selected={defaultPrivacy} onSelect={setDefaultPrivacy} />
      <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: -Spacing.one }}>
        Who can see a new activity. You can still change it each time you save one.
      </ThemedText>

      <SettingsSection title="Routes">
        <SettingsRow
          icon="shield-checkmark-outline"
          title="Private places"
          subtitle={`${privateZonesSummary(zoneCount)} · hide routes near home or work`}
          onPress={() => router.push('/privacy-zones')}
        />
        <SettingsRow
          icon="eye-off-outline"
          title="Hide route start and end"
          subtitle={
            hideRouteEnds
              ? "On · others won't see at least the first and last 200 m"
              : 'Off · others see the whole route'
          }
          extra={
            <AppSwitch
              checked={hideRouteEnds}
              onChange={setHideRouteEnds}
              label="Hide the start and end of routes"
            />
          }
        />
      </SettingsSection>

      <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
        DEFAULT MAP VISIBILITY
      </ThemedText>
      <ChipRow options={VISIBILITY_OPTIONS} value={mapVisibility} onChange={chooseMapVisibility} />
      <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: -Spacing.one }}>
        Where a new activity starts. Other athletes' apps honour it, but it is a request, not a
        lock, and you can change it for each activity when you save it. Hiding the route also hides
        its ends, which is what files you import get.
      </ThemedText>

      <SettingsSection
        title="New activities"
        footer="These are the starting choices in the save form for activities you record or add by hand. Your own view always shows everything, and each activity can be changed when you save it."
      >
        <>
          {HIDDEN_STAT_CHOICES.map(({ stat, label }) => (
            <SettingsRow
              key={stat}
              icon="eye-off-outline"
              title={`Hide ${label.toLowerCase()}`}
              subtitle={
                defaultHiddenStats.includes(stat)
                  ? "On · other athletes' apps leave it out"
                  : 'Off · others can see it'
              }
              extra={
                <AppSwitch
                  checked={defaultHiddenStats.includes(stat)}
                  onChange={(on) => setDefaultHiddenStat(stat, on)}
                  label={`Hide ${label.toLowerCase()} by default`}
                />
              }
            />
          ))}
        </>
        <SettingsRow
          icon="volume-mute-outline"
          title="Mute from Home and club feeds"
          subtitle={
            defaultMuted
              ? 'On · left out of other athletes’ Home feeds; still on your profile'
              : 'Off · shows in Home and club feeds'
          }
          extra={
            <AppSwitch
              checked={defaultMuted}
              onChange={setDefaultMuted}
              label="Mute new activities from Home and club feeds"
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="People">
        <SettingsRow
          icon="ban-outline"
          title="Blocked and muted"
          subtitle={
            hiddenCount === 0
              ? 'No one'
              : `${hiddenCount} ${hiddenCount === 1 ? 'person' : 'people'}`
          }
          onPress={() => router.push('/blocked')}
        />
      </SettingsSection>
    </SettingsScreen>
  );
}
