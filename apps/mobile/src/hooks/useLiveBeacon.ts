import { useCallback, useEffect, useRef, useState } from 'react';
import { Share } from 'react-native';
import { ENV } from '@/constants/config';
import { useViemWallet } from '@/hooks/useViemWallet';
import { getPlatform } from '@/platform';
import { endBeacon, pushBeacon } from '@/services/arkivService';
import { useSettingsStore } from '@/stores/settingsStore';
import { logger } from '@/utils/logger';

const BEACON_INTERVAL_MS = 30_000;

interface Progress {
  fix: { latitude: number; longitude: number } | null | undefined;
  distance: number;
  duration: number;
}

/**
 * Live beacon: a 10-minute Arkiv entity the server patches every BEACON_INTERVAL_MS, so friends
 * can follow the run and it vanishes after. Switching it on mid-run offers the link once the
 * first update has gone out, so the link never points at nothing.
 */
export function useLiveBeacon({
  active,
  progress,
  activityLabel,
}: {
  active: boolean;
  progress: Progress;
  activityLabel: string;
}) {
  const enabled = useSettingsStore((s) => s.liveBeacon);
  const setEnabled = useSettingsStore((s) => s.setLiveBeacon);
  const { address: athlete } = useViemWallet();
  const runIdRef = useRef('');
  const [live, setLive] = useState(false);
  const shareWhenLive = useRef(false);
  const input = useRef(progress);
  input.current = progress;
  const labelRef = useRef(activityLabel);
  labelRef.current = activityLabel;

  const share = useCallback(() => {
    Share.share({
      message: `Follow my ${labelRef.current.toLowerCase()} live on Stryde: ${ENV.API_URL}/api/live/${runIdRef.current}`,
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!active || !enabled || !athlete) return;
    if (!runIdRef.current) {
      runIdRef.current = getPlatform()
        .ids.next()
        .replace(/[^A-Za-z0-9_-]/g, '')
        .padEnd(8, '0')
        .slice(0, 32);
    }
    const push = () => {
      const { fix: last, distance: distanceM, duration: durationMs } = input.current;
      if (!last) return;
      const durationSec = durationMs / 1000;
      pushBeacon({
        runId: runIdRef.current,
        athlete,
        latitude: last.latitude,
        longitude: last.longitude,
        paceSecPerKm: distanceM > 50 ? Math.round(durationSec / (distanceM / 1000)) : 0,
      })
        .then(() => {
          setLive(true);
          if (shareWhenLive.current) {
            shareWhenLive.current = false;
            share();
          }
        })
        .catch((error) => {
          setLive(false);
          logger.warn('[Record] Beacon update failed', error);
        });
    };
    push();
    const interval = setInterval(push, BEACON_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active, enabled, athlete, share]);

  const end = () => {
    if (runIdRef.current && live) endBeacon(runIdRef.current).catch(() => undefined);
    runIdRef.current = '';
    shareWhenLive.current = false;
    setLive(false);
  };

  const toggle = (on: boolean) => {
    setEnabled(on);
    if (!on) {
      end();
      return;
    }
    if (!active) return;
    if (live) share();
    else shareWhenLive.current = true;
  };

  /** The flyout row needs a wallet and an API the app was pointed at; without them it is left out. */
  const available = ENV.API_CONFIGURED && Boolean(athlete);

  return { enabled, live, available, share, end, toggle };
}
