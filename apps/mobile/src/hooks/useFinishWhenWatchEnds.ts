import { useEffect, useRef } from 'react';
import type { WatchState } from '@/platform/ports';

/**
 * Ending the workout on the watch finishes the recording on the phone too, exactly as if Finish was pressed
 * here (the save screen opens, or the too-short prompt shows). Runs once per end.
 */
export function useFinishWhenWatchEnds(
  watchState: WatchState | undefined,
  recording: boolean,
  finish: () => unknown
): void {
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const ended = watchState === 'ended' && recording;
  useEffect(() => {
    if (ended) void finishRef.current();
  }, [ended]);
}
