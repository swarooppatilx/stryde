import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/button';
import { ChipRow } from '@/components/filter-chips';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { mapboxStyleUrl } from '@/constants/mapboxStyle';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPlatform } from '@/platform';
import { mapboxOfflinePacks, NO_OFFLINE_MAP, type OfflineMapStatus } from '@/services/offlineMaps';
import {
  downloadRegion,
  listOfflineStorage,
  type OfflineStorage,
  removeRegion,
} from '@/services/offlineRegions';
import { findPlaces, type PlaceResult } from '@/services/placeSearch';
import { resolveMapStyle, useMapPrefsStore } from '@/stores/mapPrefsStore';
import { Alert } from '@/utils/alert';
import { logger } from '@/utils/logger';
import {
  deepestZoomWithinCap,
  estimateRegion,
  formatBytes,
  MAX_REGION_TILES,
  RADIUS_OPTIONS_KM,
  regionAround,
  ZOOM_PRESETS,
  type ZoomPreset,
} from '@/utils/offlineEstimate';
import { Toast } from '@/utils/toast';

const RADIUS_CHOICES = RADIUS_OPTIONS_KM.map((km) => ({ value: String(km), label: `${km} km` }));
const DETAIL_CHOICES = ZOOM_PRESETS.map((p) => ({ value: p.id, label: p.label }));

/** Save map areas on the phone for places with no signal: pick where, how far and how detailed, see the size first. */
export default function OfflineMapsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ lng?: string; lat?: string }>();
  const stylePref = useMapPrefsStore((s) => s.style);
  const mapType = useMapPrefsStore((s) => s.mapType);

  const fromMap = useMemo<PlaceResult | null>(() => {
    const longitude = Number(params.lng);
    const latitude = Number(params.lat);
    if (!params.lng || !params.lat || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      return null;
    }
    return { id: 'map-centre', name: 'Current area', latitude, longitude };
  }, [params.lng, params.lat]);

  const [place, setPlace] = useState<PlaceResult | null>(fromMap);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [radius, setRadius] = useState('5');
  const [detail, setDetail] = useState<ZoomPreset['id']>('streets');
  const [status, setStatus] = useState<OfflineMapStatus>(NO_OFFLINE_MAP);
  const [storage, setStorage] = useState<OfflineStorage | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStorage(await listOfflineStorage(mapboxOfflinePacks));
    } catch (error) {
      logger.warn('[OfflineMaps] Could not list saved areas', error);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const preset = ZOOM_PRESETS.find((p) => p.id === detail) ?? (ZOOM_PRESETS[1] as ZoomPreset);
  const bounds = place ? regionAround([place.longitude, place.latitude], Number(radius)) : null;
  const imagery = mapType !== 'standard';
  const estimate = bounds ? estimateRegion(bounds, preset.min, preset.max, imagery) : null;
  const fits = bounds ? deepestZoomWithinCap(bounds, preset.min, preset.max) : null;
  const downloading = status.state === 'downloading';

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const found = await findPlaces(getPlatform().geocoder, query.trim());
      setResults(found);
      if (found.length === 0) Toast.info('No places found', 2);
    } catch (error) {
      logger.warn('[OfflineMaps] Place search failed', error);
      Toast.fail("Couldn't search for places", 2);
    } finally {
      setSearching(false);
    }
  };

  const download = async () => {
    if (!place || !bounds || !estimate || estimate.tooLarge || downloading) return;
    const dark = resolveMapStyle(stylePref, theme.isDark) === 'dark';
    await downloadRegion(
      mapboxOfflinePacks,
      {
        name: place.name,
        styleURL: mapboxStyleUrl(dark, mapType),
        bounds,
        minZoom: preset.min,
        maxZoom: preset.max,
        stamp: getPlatform().clock.now(),
      },
      (next) => {
        setStatus(next);
        if (next.state === 'ready') {
          Toast.success('Saved for offline use', 2);
          void refresh();
        }
        if (next.state === 'failed') Toast.fail("The download didn't finish", 2);
      }
    );
  };

  const confirmRemove = (id: string, name: string) =>
    Alert.alert(`Remove ${name}?`, 'The map for this area is deleted from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeRegion(mapboxOfflinePacks, id)
            .then(refresh)
            .catch((error: unknown) => {
              logger.warn('[OfflineMaps] Could not remove the area', error);
              Toast.fail("Couldn't remove that area", 2);
            });
        },
      },
    ]);

  return (
    <SettingsScreen title="Offline maps">
      <SettingsSection
        title="On this phone"
        footer={
          storage && storage.routeMapCount > 0
            ? `Includes the maps saved with ${storage.routeMapCount} of your routes, which you manage from each route.`
            : 'Maps you save stay until you remove them.'
        }
      >
        <SettingsRow
          icon="cloud-done-outline"
          title="Space used"
          subtitle={storage ? formatBytes(storage.totalBytes) : 'Checking...'}
        />
      </SettingsSection>

      <SettingsSection
        title="Save an area"
        footer="Sizes are estimates. The map type you use now (standard or satellite) is the one that is saved."
      >
        <SettingsRow
          icon="location-outline"
          title={place ? place.name : 'No place chosen'}
          subtitle={place ? 'The area is centred here' : 'Search for a town or place below'}
        />
      </SettingsSection>
      <View style={styles.block}>
        <TextField
          placeholder="Search for a place"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void search()}
          returnKeyType="search"
          accessibilityLabel="Search for a place"
        />
        <AppButton
          variant="secondary"
          size="small"
          disabled={searching}
          onPress={() => void search()}
        >
          {searching ? 'Searching...' : 'Search'}
        </AppButton>
        {results.map((result) => (
          <Tappable
            key={result.id}
            style={styles.result}
            accessibilityRole="button"
            accessibilityLabel={`Use ${result.name}`}
            onPress={() => {
              setPlace(result);
              setResults([]);
            }}
          >
            <ThemedText numberOfLines={2}>{result.name}</ThemedText>
          </Tappable>
        ))}

        <ThemedText type="eyebrow" themeColor="textSecondary">
          How far from the centre
        </ThemedText>
        <ChipRow options={RADIUS_CHOICES} value={radius} onChange={setRadius} />
        <ThemedText type="eyebrow" themeColor="textSecondary">
          How much detail
        </ThemedText>
        <ChipRow options={DETAIL_CHOICES} value={detail} onChange={setDetail} />
        <ThemedText type="caption" themeColor="textSecondary">
          {preset.hint}
        </ThemedText>

        {estimate && (
          <ThemedText
            accessibilityLiveRegion="polite"
            themeColor={estimate.tooLarge ? 'dangerText' : 'text'}
          >
            {estimate.tooLarge
              ? `Too big: about ${estimate.tiles.toLocaleString()} map tiles, and the limit is ${MAX_REGION_TILES.toLocaleString()}. ${
                  fits === null ? 'Choose a smaller area.' : 'Choose a smaller area or less detail.'
                }`
              : `About ${formatBytes(estimate.bytes)} (${estimate.tiles.toLocaleString()} map tiles)`}
          </ThemedText>
        )}

        {downloading && (
          <ThemedText accessibilityLiveRegion="polite">Downloading... {status.percent}%</ThemedText>
        )}
        <AppButton
          disabled={!place || !estimate || estimate.tooLarge || downloading}
          onPress={() => void download()}
        >
          Download area
        </AppButton>
      </View>

      <SettingsSection title="Saved areas">
        {storage && storage.regions.length > 0 ? (
          storage.regions.map((region) => (
            <SettingsRow
              key={region.id}
              icon={region.ready ? 'checkmark-circle-outline' : 'cloud-download-outline'}
              title={region.name}
              subtitle={
                region.ready
                  ? formatBytes(region.bytes)
                  : `Not finished: ${region.percent}%, ${formatBytes(region.bytes)} so far`
              }
              onPress={() => confirmRemove(region.id, region.name)}
            />
          ))
        ) : (
          <SettingsRow
            icon="map-outline"
            title="Nothing saved yet"
            subtitle="Areas you download appear here; tap one to remove it"
          />
        )}
      </SettingsSection>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.two, paddingVertical: Spacing.two },
  result: { paddingVertical: Spacing.two },
});
