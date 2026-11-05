/** Reload a feed that failed to load, but only at the moment the connection returns: never in a loop. */
export function shouldRefreshOnReconnect({
  wasOnline,
  online,
  feedStatus,
}: {
  wasOnline: boolean;
  online: boolean;
  feedStatus: 'idle' | 'loading' | 'ready' | 'error';
}): boolean {
  return online && !wasOnline && feedStatus === 'error';
}
