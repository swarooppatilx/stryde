export type DetailFallback = 'loading' | 'error' | 'missing';

/**
 * What a detail screen shows when the item it was opened for isn't in the store:
 * a failed load is not the same as an item that doesn't exist.
 */
export function detailFallback({
  loading,
  error,
}: {
  loading: boolean;
  error: string | null;
}): DetailFallback {
  if (loading) return 'loading';
  return error ? 'error' : 'missing';
}
