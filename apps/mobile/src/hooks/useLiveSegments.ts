import { useEffect, useRef, useState } from 'react';
import { useOnline } from '@/hooks/useOnline';
import { useViemWallet } from '@/hooks/useViemWallet';
import {
  athleteEfforts,
  type Effort,
  nearbySegments,
  type Segment,
  segmentLeaderboard,
} from '@/services/arkivService';
import {
  createLiveSegmentTracker,
  type LiveSegment,
  type LiveSegmentStatus,
} from '@/utils/liveSegments';
import { logger } from '@/utils/logger';

interface Fix {
  latitude: number;
  longitude: number;
  timestamp: number;
}

/** The athlete's fastest time per segment key, from their own efforts. */
export function personalBests(efforts: readonly Effort[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const effort of efforts) {
    const current = best.get(effort.segmentKey);
    if (current === undefined || effort.elapsedSec < current) {
      best.set(effort.segmentKey, effort.elapsedSec);
    }
  }
  return best;
}

export function toLiveSegments(
  segments: readonly Segment[],
  pbs: ReadonlyMap<string, number>
): LiveSegment[] {
  return segments.map((s) => ({
    key: s.key,
    name: s.name,
    start: s.start,
    end: s.end,
    distanceM: s.distanceM,
    prSec: pbs.get(s.key) ?? null,
    leaderSec: null,
  }));
}

/**
 * The segment being ridden right now, with its time against your PR or the leader. Segments near
 * the start are fetched once when recording begins; with no network there are simply none. A
 * leader time is fetched the first time a segment is entered.
 */
export function useLiveSegments(active: boolean, fix: Fix | null | undefined) {
  const online = useOnline();
  const { address } = useViemWallet();
  const tracker = useRef(createLiveSegmentTracker());
  const segments = useRef<LiveSegment[]>([]);
  const askedLeader = useRef(new Set<string>());
  const loaded = useRef(false);
  const [status, setStatus] = useState<LiveSegmentStatus | null>(null);
  const firstFix = fix ? { latitude: fix.latitude, longitude: fix.longitude } : null;
  const hasFix = firstFix !== null;
  const startLat = useRef(0);
  const startLng = useRef(0);
  if (!loaded.current && firstFix) {
    startLat.current = firstFix.latitude;
    startLng.current = firstFix.longitude;
  }

  useEffect(() => {
    if (!active) {
      loaded.current = false;
      segments.current = [];
      askedLeader.current.clear();
      tracker.current.setSegments([]);
      tracker.current.reset();
      setStatus(null);
      return;
    }
    if (loaded.current || !hasFix || !online) return;
    loaded.current = true;
    let cancelled = false;
    (async () => {
      const near = await nearbySegments(startLat.current, startLng.current);
      const mine = address ? await athleteEfforts(address).catch(() => ({ efforts: [] })) : null;
      if (cancelled) return;
      segments.current = toLiveSegments(near.segments, personalBests(mine?.efforts ?? []));
      tracker.current.setSegments(segments.current);
    })().catch((error) => {
      loaded.current = false;
      logger.warn('[Record] Live segments unavailable', error);
    });
    return () => {
      cancelled = true;
    };
  }, [active, hasFix, online, address]);

  const stamp = fix?.timestamp;
  const lat = fix?.latitude;
  const lng = fix?.longitude;
  useEffect(() => {
    if (!active || stamp === undefined || lat === undefined || lng === undefined) return;
    if (segments.current.length === 0) return;
    const next = tracker.current.update({ latitude: lat, longitude: lng, timestamp: stamp });
    setStatus((prev) => (sameStatus(prev, next) ? prev : next));
    if (next && online && !askedLeader.current.has(next.key)) {
      askedLeader.current.add(next.key);
      const key = next.key;
      segmentLeaderboard(key, 'verified')
        .then(({ efforts }) => {
          const top = efforts[0]?.elapsedSec;
          if (top === undefined) return;
          segments.current = segments.current.map((s) =>
            s.key === key ? { ...s, leaderSec: top } : s
          );
          tracker.current.setSegments(segments.current);
        })
        .catch(() => askedLeader.current.delete(key));
    }
  }, [active, stamp, lat, lng, online]);

  return status;
}

function sameStatus(a: LiveSegmentStatus | null, b: LiveSegmentStatus | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.key === b.key &&
    a.elapsedSec === b.elapsedSec &&
    a.prSec === b.prSec &&
    a.leaderSec === b.leaderSec
  );
}
