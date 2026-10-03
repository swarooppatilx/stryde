interface CountdownHandlers {
  onTick: (remaining: number) => void;
  /** Called once when the count reaches zero (or at once for a count of zero). */
  onDone: () => void;
}

/** Counts down from `seconds`, once per second. Returns a function that stops it without calling `onDone`. */
export function startCountdown(seconds: number, { onTick, onDone }: CountdownHandlers): () => void {
  if (seconds <= 0) {
    onDone();
    return () => {};
  }

  let remaining = seconds;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const step = () => {
    onTick(remaining);
    timer = setTimeout(() => {
      remaining -= 1;
      if (remaining <= 0) {
        timer = null;
        onDone();
      } else {
        step();
      }
    }, 1000);
  };
  step();

  return () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
