import type { CameraRef } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getCurrentUserId } from '@/constants/config';
import { useActivityStore } from '@/stores/activityStore';
import { useTerritoryStore } from '@/stores/territoryStore';
import type { Ring } from '@/types';
import { parsePolyline } from '@/utils/format';

function locationErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.includes('unsatisfied device settings')) {
    return 'Turn on device location (GPS) to see the map.';
  }
  return err instanceof Error ? err.message : 'Unable to get your location.';
}

export type FollowMode = 'default' | 'heading' | null;

export interface MapActivityRoute {
  id: string;
  coordinates: [number, number][];
  color?: string;
  lineWidth?: number;
}

export function useMap() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState<FollowMode>('default');
  const [showRoutes, setShowRoutes] = useState(false);
  const cameraRef = useRef<CameraRef>(null);
  const getUserPolygons = useTerritoryStore((s) => s.getUserPolygons);
  const userId = getCurrentUserId();
  const userPolygons: Ring[] = useMemo(() => getUserPolygons(userId), [getUserPolygons, userId]);
  const activities = useActivityStore((s) => s.activities);

  const loadLocation = useCallback(async () => {
    setErrorMsg(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      // A cached fix is faster and works even when the device (or an
      // emulator's simulated GPS) can't get a fresh live fix in time.
      const cached = await Location.getLastKnownPositionAsync();
      if (cached) {
        setLocation({ latitude: cached.coords.latitude, longitude: cached.coords.longitude });
      }

      try {
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({ latitude: fresh.coords.latitude, longitude: fresh.coords.longitude });
      } catch (freshErr) {
        // A cached fix already rendered the map - a failed live-fix refresh
        // isn't worth surfacing as an error.
        if (!cached) throw freshErr;
      }
    } catch (err) {
      setErrorMsg(locationErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  // Granting permission or turning on GPS both send the app to the background
  // (Android's own system dialogs for these) and back. Retry silently on
  // return instead of leaving the user to tap "Try Again" as a third prompt
  // on top of the two system ones they just handled.
  const hasLocation = location !== null;
  useEffect(() => {
    if (hasLocation) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadLocation();
    });
    return () => subscription.remove();
  }, [hasLocation, loadLocation]);

  const recenter = () => {
    if (location) {
      cameraRef.current?.easeTo({
        center: [location.longitude, location.latitude],
        zoom: 15,
        duration: 300,
      });
    }
  };

  const toggleFollow = () => {
    setFollowMode((prev) => {
      if (prev === null) return 'default';
      if (prev === 'default') return 'heading';
      return null;
    });
  };

  const toggleRoutes = () => {
    setShowRoutes((prev) => !prev);
  };

  const activityRoutes = showRoutes
    ? activities
        .filter((a) => a.polyline)
        .map((a) => ({
          id: a.id,
          coordinates: parsePolyline(a.polyline),
        }))
        .filter((r) => r.coordinates.length >= 2)
    : [];

  return {
    location,
    errorMsg,
    followMode,
    showRoutes,
    cameraRef,
    userPolygons,
    activityRoutes,
    loadLocation,
    recenter,
    toggleFollow,
    toggleRoutes,
  };
}
