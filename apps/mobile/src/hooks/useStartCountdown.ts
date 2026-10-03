import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { startCountdown } from '@/utils/countdown';
import { haptics } from '@/utils/haptics';

/** Count-in before recording per the athlete's setting: `counting` is the number on screen (null when idle), `begin(value)` starts it and calls `onStart(value)` at the end, `cancel` stops it. */
export function useStartCountdown<T>(onStart: (value: T) => void) {
  const seconds = useSettingsStore((s) => s.countdownSeconds);
  const [counting, setCounting] = useState<number | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const latestOnStart = useRef(onStart);
  latestOnStart.current = onStart;

  const cancel = useCallback(() => {
    stop.current?.();
    stop.current = null;
    setCounting(null);
  }, []);

  const begin = useCallback(
    (value: T) => {
      stop.current?.();
      stop.current = startCountdown(seconds, {
        onTick: (remaining) => {
          setCounting(remaining);
          haptics.tap();
        },
        onDone: () => {
          stop.current = null;
          setCounting(null);
          latestOnStart.current(value);
        },
      });
    },
    [seconds]
  );

  // Leaving the screen mid-count must not start a recording the athlete walked away from.
  useEffect(() => cancel, [cancel]);

  return { counting, begin, cancel };
}
