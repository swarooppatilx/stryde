import { stockImageIndex } from '@/utils/stockImage';

/** Photos for clubs, events and challenges; the order must match STOCK_IMAGE_COUNT in utils/stockImage.ts. */
// `require` of a bundled image is a numeric asset id, which expo-image accepts directly.
const STOCK_IMAGES: readonly number[] = [
  require('../../assets/images/stock/crew-low-angle.jpg'),
  require('../../assets/images/stock/crew-desert-road.jpg'),
  require('../../assets/images/stock/smile-street.jpg'),
  require('../../assets/images/stock/post-run-floor.jpg'),
  require('../../assets/images/stock/finishers-medals.jpg'),
];

/** The photo for an item, e.g. `stockImageFor('club', 7n)`. */
export function stockImageFor(kind: 'club' | 'event' | 'challenge', id: string | bigint) {
  return STOCK_IMAGES[stockImageIndex(`${kind}:${id}`)] ?? STOCK_IMAGES[0];
}
