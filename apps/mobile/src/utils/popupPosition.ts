export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SCREEN_MARGIN = 8;
const GAP = 4;

/**
 * Where a dropdown menu sits relative to the button that opened it: under it with the left edges
 * lined up so the menu extends to the right, kept inside the screen, and above the button instead
 * when there is no room below.
 */
export function popupMenuPosition({
  anchor,
  window,
  menu,
}: {
  anchor: Box;
  window: { width: number; height: number };
  menu: { width: number; height: number };
}): { left: number; top: number } {
  const maxLeft = window.width - menu.width - SCREEN_MARGIN;
  const left = Math.max(SCREEN_MARGIN, Math.min(anchor.x, maxLeft));

  const below = anchor.y + anchor.height + GAP;
  const fitsBelow = below + menu.height <= window.height - SCREEN_MARGIN;
  const top = fitsBelow ? below : Math.max(SCREEN_MARGIN, anchor.y - GAP - menu.height);
  return { left, top };
}
