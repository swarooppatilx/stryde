import { useEffect, useMemo, useRef } from 'react';
import { createDoubleTap } from '@/utils/doubleTap';

/** A tap handler that calls `onDouble` for two quick taps and `onSingle` for one. */
export function useDoubleTap(onSingle: () => void, onDouble: () => void) {
  // The handlers change every render; the timer must keep calling the latest ones.
  const latest = useRef({ onSingle, onDouble });
  useEffect(() => {
    latest.current = { onSingle, onDouble };
  });

  return useMemo(
    () =>
      createDoubleTap({
        onSingle: () => latest.current.onSingle(),
        onDouble: () => latest.current.onDouble(),
      }),
    []
  );
}
