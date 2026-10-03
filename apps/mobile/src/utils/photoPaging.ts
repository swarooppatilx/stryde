/** Which photo a horizontally paged viewer is showing, from its scroll offset. Always a real index. */
export function pageIndex(offsetX: number, pageWidth: number, count: number): number {
  if (pageWidth <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offsetX / pageWidth)));
}

/** "2 of 4" for the viewer's corner; empty for a single photo, where there is nothing to count. */
export function pageCounter(index: number, count: number): string {
  return count > 1 ? `${index + 1} of ${count}` : '';
}

/** "2/4": the short form for a chip on the photo itself; empty for a single photo. */
export function pagePosition(index: number, count: number): string {
  return count > 1 ? `${index + 1}/${count}` : '';
}
