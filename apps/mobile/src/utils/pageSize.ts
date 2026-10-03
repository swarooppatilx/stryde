/** How many items to show after the reader scrolls to the end: one more page, capped at the total. */
export function nextVisibleCount(current: number, total: number, pageSize: number): number {
  return Math.min(current + pageSize, total);
}
