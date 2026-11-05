import { logger } from '@/utils/logger';

interface MintMissingOptions<Id> {
  ids: readonly Id[];
  getMinted(ids: readonly Id[]): Promise<ReadonlySet<Id>>;
  mint(id: Id): Promise<void>;
  /** Called with everything known to be minted, first after the read, then after each mint. */
  onMinted(minted: ReadonlySet<Id>): void;
  isCancelled(): boolean;
  onError?(id: Id, error: unknown): void;
}

/**
 * Mints whichever of `ids` aren't minted yet, one at a time. Unknown state (the read failed)
 * mints nothing: guessing would resend mints that already went through.
 */
export async function mintMissing<Id>({
  ids,
  getMinted,
  mint,
  onMinted,
  isCancelled,
  onError,
}: MintMissingOptions<Id>): Promise<void> {
  let minted: Set<Id>;
  try {
    minted = new Set(await getMinted(ids));
  } catch (error) {
    logger.warn('[mintMissing] Could not read what is already minted', error);
    return;
  }
  if (isCancelled()) return;
  onMinted(minted);

  for (const id of ids) {
    if (isCancelled()) return;
    if (minted.has(id)) continue;
    try {
      await mint(id);
      minted = new Set(minted).add(id);
      if (!isCancelled()) onMinted(minted);
    } catch (error) {
      onError?.(id, error);
    }
  }
}
