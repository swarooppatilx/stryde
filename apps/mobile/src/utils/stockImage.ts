/** How many stock photos there are in `constants/stockImages.ts`; kept here so the picker stays free of asset imports. */
export const STOCK_IMAGE_COUNT = 5;

/**
 * Which stock photo a club, event or challenge wears. Derived from its id so it never changes between
 * launches or devices (there is nothing on-chain to store a choice in), and callers pass a kind prefix
 * (`club:7`, `challenge:7`) so the same number in two lists does not always share a photo.
 */
export function stockImageIndex(id: string | bigint): number {
  const text = typeof id === 'bigint' ? id.toString() : id;
  // FNV-1a: tiny, no dependency, and spreads sequential ids well enough for five photos.
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % STOCK_IMAGE_COUNT;
}
