interface DoubleTapOptions {
  onSingle(): void;
  onDouble(): void;
  delayMs?: number;
}

/**
 * Tells one tap from two. A first tap waits for a second; if none comes the tap is
 * single, so a single tap is reported after `delayMs`, never instantly.
 */
export function createDoubleTap({ onSingle, onDouble, delayMs = 250 }: DoubleTapOptions) {
  let pending: ReturnType<typeof setTimeout> | null = null;

  return function tap(): void {
    if (pending === null) {
      pending = setTimeout(() => {
        pending = null;
        onSingle();
      }, delayMs);
      return;
    }
    clearTimeout(pending);
    pending = null;
    onDouble();
  };
}
