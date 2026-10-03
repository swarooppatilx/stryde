const MIN_SCALE = 1;
const MAX_SCALE = 4;
/** How far a photo is dragged down or up, in points, before letting go closes the viewer. */
export const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 1000;
const MIN_BACKDROP = 0.2;

export function clampScale(scale: number): number {
  'worklet';
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** A zoomed photo can move only until its edge meets the screen's: `size` is the photo's unzoomed width or height. */
export function clampPan(translate: number, scale: number, size: number): number {
  'worklet';
  const limit = Math.max(0, (size * scale - size) / 2);
  return Math.min(limit, Math.max(-limit, translate));
}

export function shouldDismiss(translateY: number, velocityY: number): boolean {
  'worklet';
  return Math.abs(translateY) > DISMISS_DISTANCE || Math.abs(velocityY) > DISMISS_VELOCITY;
}

/** Backdrop opacity while a photo is dragged vertically: opaque at rest, fading to a floor. */
export function dismissOpacity(translateY: number): number {
  'worklet';
  const faded = 1 - Math.abs(translateY) / (DISMISS_DISTANCE * 2.5);
  return Math.max(MIN_BACKDROP, Math.min(1, faded));
}
