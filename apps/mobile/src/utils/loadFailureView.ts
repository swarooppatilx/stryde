export type LoadFailureView = 'none' | 'banner' | 'error';

/**
 * What a list shows after a load: nothing extra, a quiet banner above what is already on the phone,
 * or the full error because there is nothing else to show.
 */
export function loadFailureView(state: { failed: boolean; hasCached: boolean }): LoadFailureView {
  if (!state.failed) return 'none';
  return state.hasCached ? 'banner' : 'error';
}
