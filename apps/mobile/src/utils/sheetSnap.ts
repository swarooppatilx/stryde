export type SheetSnap = 'collapsed' | 'peek' | 'expanded';

export const SHEET_HEIGHTS: Record<SheetSnap, number> = {
  collapsed: 24,
  peek: 200,
  expanded: 420,
};

/** The sheet's resting heights from lowest to highest, in the order the bottom sheet indexes them. */
export const SHEET_SNAP_POINTS = [
  SHEET_HEIGHTS.collapsed,
  SHEET_HEIGHTS.peek,
  SHEET_HEIGHTS.expanded,
] as const;
