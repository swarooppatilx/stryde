import { useRouter } from 'expo-router';
import { AppSwitch } from '@/components/app-switch';
import { ChipRow } from '@/components/filter-chips';
import { PrivacyPicker } from '@/components/privacy-picker';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { type TKey, useT } from '@/i18n';
import { useBlockStore } from '@/stores/blockStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  HIDDEN_STAT_CHOICES,
  type MapVisibility,
  mapVisibilityOf,
  switchesForMapVisibility,
} from '@/utils/privacyDefaults';
import { privateZonesSummary } from '@/utils/settingsSummary';

const VISIBILITY_KEY: Record<MapVisibility, TKey> = {
  show: 'privacySafety.mapShow',
  ends: 'privacySafety.mapEnds',
  hide: 'privacySafety.mapHide',
};

const VISIBILITY_ORDER: readonly MapVisibility[] = ['show', 'ends', 'hide'];

const STAT_KEY: Record<(typeof HIDDEN_STAT_CHOICES)[number]['stat'], TKey> = {
  start_time: 'privacySafety.statStartTime',
  pace: 'privacySafety.statPace',
};

export default function PrivacySafetyScreen() {
  const t = useT();
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
    <SettingsScreen title={t('privacySafety.title')}>
      <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
        {t('privacySafety.headingVisibility')}
      </ThemedText>
      <PrivacyPicker selected={defaultPrivacy} onSelect={setDefaultPrivacy} />
      <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: -Spacing.one }}>
        {t('privacySafety.visibilityCaption')}
      </ThemedText>

      <SettingsSection title={t('privacySafety.sectionRoutes')}>
        <SettingsRow
          icon="shield-checkmark-outline"
          title={t('privacySafety.privatePlaces')}
          subtitle={t('privacySafety.privatePlacesHint', {
            summary: privateZonesSummary(zoneCount, t),
          })}
          onPress={() => router.push('/privacy-zones')}
        />
        <SettingsRow
          icon="eye-off-outline"
          title={t('privacySafety.hideEnds')}
          subtitle={hideRouteEnds ? t('privacySafety.hideEndsOn') : t('privacySafety.hideEndsOff')}
          extra={
            <AppSwitch
              checked={hideRouteEnds}
              onChange={setHideRouteEnds}
              label={t('privacySafety.hideEndsLabel')}
            />
          }
        />
      </SettingsSection>

      <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
        {t('privacySafety.headingMap')}
      </ThemedText>
      <ChipRow
        options={VISIBILITY_ORDER.map((value) => ({ value, label: t(VISIBILITY_KEY[value]) }))}
        value={mapVisibility}
        onChange={chooseMapVisibility}
      />
      <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: -Spacing.one }}>
        {t('privacySafety.mapCaption')}
      </ThemedText>

      <SettingsSection title={t('privacySafety.sectionNew')} footer={t('privacySafety.newFooter')}>
        <>
          {HIDDEN_STAT_CHOICES.map(({ stat }) => {
            const name = t(STAT_KEY[stat]);
            const hidden = defaultHiddenStats.includes(stat);
            return (
              <SettingsRow
                key={stat}
                icon="eye-off-outline"
                title={t('privacySafety.hideStat', { stat: name })}
                subtitle={hidden ? t('privacySafety.hideStatOn') : t('privacySafety.hideStatOff')}
                extra={
                  <AppSwitch
                    checked={hidden}
                    onChange={(on) => setDefaultHiddenStat(stat, on)}
                    label={t('privacySafety.hideStatLabel', { stat: name })}
                  />
                }
              />
            );
          })}
        </>
        <SettingsRow
          icon="volume-mute-outline"
          title={t('privacySafety.mute')}
          subtitle={defaultMuted ? t('privacySafety.muteOn') : t('privacySafety.muteOff')}
          extra={
            <AppSwitch
              checked={defaultMuted}
              onChange={setDefaultMuted}
              label={t('privacySafety.muteLabel')}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title={t('privacySafety.sectionPeople')}>
        <SettingsRow
          icon="ban-outline"
          title={t('privacySafety.blocked')}
          subtitle={
            hiddenCount === 0
              ? t('privacySafety.blockedNone')
              : t('privacySafety.blockedCount', { count: hiddenCount })
          }
          onPress={() => router.push('/blocked')}
        />
      </SettingsSection>
    </SettingsScreen>
  );
}
