import * as ExpoLocation from 'expo-location';
import { Linking } from 'react-native';
import type { Geocoder, LocationPermission, LocationSource, WatchOptions } from '@/platform/ports';
import type { AccuracyMode } from '@/stores/settingsStore';
import type { Location } from '@/types';
import { fixFromCoords } from './fixFromCoords';

const ACCURACY: Record<AccuracyMode, ExpoLocation.LocationAccuracy> = {
  best: ExpoLocation.Accuracy.BestForNavigation,
  balanced: ExpoLocation.Accuracy.Balanced,
  power: ExpoLocation.Accuracy.Low,
};

/**
 * Google Play's "improved accuracy" dialog is left to the athlete's own phone settings: asked from
 * every watch it reappeared each time the Record tab opened, even after "No, thanks". GPS alone
 * records fine without it.
 */
const NO_SETTINGS_DIALOG = { mayShowUserSettingsDialog: false } as const;

function toFix(object: ExpoLocation.LocationObject): Location {
  return fixFromCoords(object.coords, object.timestamp, object.mocked);
}

function toPermission(response: ExpoLocation.LocationPermissionResponse): LocationPermission {
  return {
    granted: response.granted,
    canAskAgain: response.canAskAgain,
    precise: response.android?.accuracy !== 'coarse',
  };
}

export const expoLocationSource: LocationSource = {
  async getPermission() {
    return toPermission(await ExpoLocation.getForegroundPermissionsAsync());
  },

  async requestPermission() {
    return toPermission(await ExpoLocation.requestForegroundPermissionsAsync());
  },

  watch(options: WatchOptions, onFix) {
    return ExpoLocation.watchPositionAsync(
      {
        accuracy: ACCURACY[options.accuracy],
        timeInterval: options.timeIntervalMs,
        distanceInterval: options.distanceIntervalM,
        ...NO_SETTINGS_DIALOG,
      },
      (object) => onFix(toFix(object))
    );
  },

  async getCurrent(accuracy) {
    return toFix(
      await ExpoLocation.getCurrentPositionAsync({
        accuracy: ACCURACY[accuracy],
        ...NO_SETTINGS_DIALOG,
      })
    );
  },

  async getLastKnown() {
    const object = await ExpoLocation.getLastKnownPositionAsync();
    return object ? toFix(object) : null;
  },

  servicesEnabled() {
    return ExpoLocation.hasServicesEnabledAsync();
  },

  openSettings() {
    return Linking.openSettings();
  },
};

export const expoGeocoder: Geocoder = {
  async geocode(query) {
    return ExpoLocation.geocodeAsync(query);
  },
  async placeName(latitude, longitude) {
    const [place] = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
    if (!place) return null;
    return [place.name, place.city, place.region, place.country].filter(Boolean).join(', ') || null;
  },
};
