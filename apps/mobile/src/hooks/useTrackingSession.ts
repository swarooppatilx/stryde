import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useShallow } from 'zustand/shallow';
import { type SessionOptions, trackingSession } from '@/services/trackingSession';
import { ACCURACY_MODE_CONFIG, useSettingsStore } from '@/stores/settingsStore';
import type { ActivityType } from '@/types';
import { autoPauseFor } from '@/utils/autoPause';
import { METERS_PER_MILE } from '@/utils/format';
import { logger } from '@/utils/logger';
import { setTrackTrace } from '@/utils/trackTrace';
import { useUnitSystem } from './use-unit-system';

const TICK_MS = 1000;

export function useTrackingSession() {
  const unitSystem = useUnitSystem();
  const {
    useGyroscopeAssist,
    autoPause,
    autoPauseOnFoot,
    accuracyMode,
    audioCueInterval,
    announceActions,
    keepScreenOn,
    verboseTrackingLog,
  } = useSettingsStore(
    useShallow((s) => ({
      verboseTrackingLog: s.verboseTrackingLog,
      useGyroscopeAssist: s.useGyroscopeAssist,
      autoPause: s.autoPause,
      autoPauseOnFoot: s.autoPauseOnFoot,
      accuracyMode: s.accuracyMode,
      audioCueInterval: s.audioCueInterval,
      announceActions: s.announceActions,
      keepScreenOn: s.keepScreenOn,
    }))
  );

  // Stable identities: the session's methods are fresh bound functions on every
  // property read, and useSyncExternalStore resubscribes if `subscribe` changes.
  const subscribe = useCallback((onChange: () => void) => trackingSession.subscribe(onChange), []);
  const getSnapshot = useCallback(() => trackingSession.getSnapshot(), []);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  const optionsFor = useCallback(
    (activityType: ActivityType, activityLabel: string): SessionOptions => ({
      activityType,
      activityLabel,
      accuracyMode,
      timeIntervalMs: ACCURACY_MODE_CONFIG[accuracyMode].timeInterval,
      useGyroscope: useGyroscopeAssist,
      autoPause: autoPauseFor(activityType, { autoPause, autoPauseOnFoot }),
      splitMeters: unitSystem === 'imperial' ? METERS_PER_MILE : 1000,
      audioCueInterval,
      announceActions,
      keepScreenOn,
      unitSystem,
    }),
    [
      accuracyMode,
      useGyroscopeAssist,
      autoPause,
      autoPauseOnFoot,
      audioCueInterval,
      announceActions,
      keepScreenOn,
      unitSystem,
    ]
  );

  const [restoreSettled, setRestoreSettled] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: restore once per mount, with the settings of that moment
  useEffect(() => {
    trackingSession
      .restore(optionsFor('run', 'Run'))
      .catch((error) => logger.warn('[TrackingSession] Restore failed', error))
      .finally(() => setRestoreSettled(true));
  }, []);

  useEffect(() => {
    const sport = snapshot.activityType;
    trackingSession.configure({
      autoPause: sport ? autoPauseFor(sport, { autoPause, autoPauseOnFoot }) : autoPause,
      useGyroscope: useGyroscopeAssist,
    });
  }, [autoPause, autoPauseOnFoot, snapshot.activityType, useGyroscopeAssist]);

  useEffect(() => setTrackTrace(verboseTrackingLog), [verboseTrackingLog]);

  const live = snapshot.status !== 'idle';
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => trackingSession.tick(), TICK_MS);
    return () => clearInterval(timer);
  }, [live]);

  // Back from the background: pull in what the background task buffered.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void trackingSession.syncBackground();
    });
    return () => sub.remove();
  }, []);

  const actions = useMemo(
    () => ({
      start: (activityType: ActivityType, activityLabel: string) =>
        trackingSession.start(optionsFor(activityType, activityLabel)),
      pause: () => trackingSession.pause(),
      resume: () => trackingSession.resume(),
      finish: () => trackingSession.finish(),
      lap: () => trackingSession.lap(),
    }),
    [optionsFor]
  );

  return { snapshot, restoreSettled, ...actions };
}
