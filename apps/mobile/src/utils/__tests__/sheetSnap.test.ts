import { describe, expect, it } from 'vitest';
import { SHEET_HEIGHTS, SHEET_SNAP_POINTS } from '@/utils/sheetSnap';

describe('SHEET_SNAP_POINTS', () => {
  it('lists the resting heights lowest first, since the sheet addresses them by index', () => {
    expect([...SHEET_SNAP_POINTS]).toEqual([...SHEET_SNAP_POINTS].sort((a, b) => a - b));
    expect(SHEET_SNAP_POINTS[1]).toBe(SHEET_HEIGHTS.peek);
    expect(SHEET_SNAP_POINTS.at(-1)).toBe(SHEET_HEIGHTS.expanded);
  });
});
