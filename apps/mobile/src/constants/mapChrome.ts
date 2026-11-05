/** Geometry of the controls floating over the Map tab. */
export const MapChrome = {
  edge: 16,
  gap: 8,
  searchHeight: 48,
  chipHeight: 32,
  /** Height of the sheet at its first snap point; the floating button sits above it. */
  fab: 48,
} as const;

/** Distance from the top safe area to the bottom of the chip row: where the compass can start. */
export const MAP_CHROME_BOTTOM =
  MapChrome.edge + MapChrome.searchHeight + MapChrome.gap + MapChrome.chipHeight;
