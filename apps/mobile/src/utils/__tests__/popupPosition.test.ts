import { describe, expect, it } from 'vitest';
import { popupMenuPosition } from '@/utils/popupPosition';

const window = { width: 400, height: 800 };
const menu = { width: 220, height: 160 };

describe('popupMenuPosition', () => {
  it('opens just below the button with its left edge lined up with the button’s, extending to the right', () => {
    const pos = popupMenuPosition({
      anchor: { x: 100, y: 60, width: 48, height: 48 },
      window,
      menu,
    });

    expect(pos).toEqual({ left: 100, top: 60 + 48 + 4 });
  });

  it('stays on screen when the button is near the left edge', () => {
    const pos = popupMenuPosition({
      anchor: { x: 2, y: 60, width: 48, height: 48 },
      window,
      menu,
    });

    expect(pos.left).toBe(8);
  });

  it('shifts left to stay on screen when the button is near the right edge', () => {
    const pos = popupMenuPosition({
      anchor: { x: 380, y: 60, width: 48, height: 48 },
      window,
      menu,
    });

    expect(pos.left + menu.width).toBe(window.width - 8);
  });

  it('opens above the button when there is no room below it', () => {
    const pos = popupMenuPosition({
      anchor: { x: 300, y: 700, width: 48, height: 48 },
      window,
      menu,
    });

    expect(pos.top).toBe(700 - 4 - menu.height);
  });

  it('never opens above the top of the screen', () => {
    const pos = popupMenuPosition({
      anchor: { x: 300, y: 40, width: 48, height: 48 },
      window: { width: 400, height: 150 },
      menu,
    });

    expect(pos.top).toBeGreaterThanOrEqual(8);
  });
});
