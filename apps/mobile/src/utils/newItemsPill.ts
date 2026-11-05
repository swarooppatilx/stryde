/** How far the feed is scrolled, in px, before the top is out of sight. */
export const NEW_ITEMS_SCROLL_OFFSET = 320;

/** Pulling down past the top reads as a negative offset, which still counts as the top. */
export function isScrolledDown(offset: number): boolean {
  return offset > NEW_ITEMS_SCROLL_OFFSET;
}

/** The newest of some item times, or null when there are none. */
export function latestTime(times: readonly number[]): number | null {
  return times.length === 0 ? null : Math.max(...times);
}

/** Whether to offer a jump to the top: newer items arrived while the reader was away from it. */
export function shouldShowNewItemsPill({
  anchorTime,
  latestTime,
  scrolledDown,
}: {
  /** Newest item time when the reader last saw the top. */
  anchorTime: number | null;
  latestTime: number | null;
  scrolledDown: boolean;
}): boolean {
  if (!scrolledDown || anchorTime === null || latestTime === null) return false;
  return latestTime > anchorTime;
}
