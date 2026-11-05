interface HoldTimerOptions {
  durationMs: number;
  onComplete(): void;
}

/** Fires `onComplete` once a press has been held for `durationMs`; letting go early cancels it. */
export function createHoldTimer({ durationMs, onComplete }: HoldTimerOptions) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    start(): void {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        onComplete();
      }, durationMs);
    },
    cancel(): void {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
    },
  };
}
