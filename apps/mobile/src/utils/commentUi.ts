import { DELIVERY_COPY } from '@/constants/copy';
import type { DeliveryState } from '@/utils/deliveryState';

/** The screen's own furniture around the comment list: header, banner, input row and the tray's margins. */
const CHROME = 260;
const MIN_LIST_HEIGHT = 140;
const LIST_SHARE = 0.55;
const COUNTDOWN_FROM = 50;

/** The small status under a comment that has not reached the server, or null when it has. */
export function deliveryLine(
  delivery: DeliveryState | undefined
): { text: string; failed: boolean } | null {
  if (!delivery) return null;
  return { text: DELIVERY_COPY[delivery], failed: delivery === 'failed' };
}

/** Characters left to show beside the input, only once the limit is close. */
export function charactersLeft(length: number, max: number): number | null {
  const left = max - length;
  return left <= COUNTDOWN_FROM ? left : null;
}

/** A comment's like count as shown beside the heart: nothing for none. */
export function likeCountText(count: number): string {
  return count > 0 ? String(count) : '';
}

/** How tall the comment list may be: over half the screen, less when the keyboard takes room. */
export function commentListMaxHeight(windowHeight: number, keyboardHeight: number): number {
  return Math.max(
    MIN_LIST_HEIGHT,
    Math.round(Math.min(windowHeight * LIST_SHARE, windowHeight - keyboardHeight - CHROME))
  );
}
