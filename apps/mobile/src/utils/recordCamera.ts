import type { Ionicons } from '@expo/vector-icons';

/** Zoom while waiting to start: wide enough to see the neighbourhood you are about to run in. */
export const WAITING_ZOOM = 14;
/** Zoom while recording or paused: close enough to read the path you are making. */
export const RECORDING_ZOOM = 16;

export type RecordStatus = 'idle' | 'tracking' | 'paused';

export function followZoom(status: RecordStatus): number {
  return status === 'idle' ? WAITING_ZOOM : RECORDING_ZOOM;
}

/** North-up keeps the map still and moves you; heading-up turns the map to face where you go. */
export type FollowMode = 'north' | 'heading';

export interface FollowState {
  following: boolean;
  /** Kept while not following, so tapping locate returns to the same view. */
  mode: FollowMode;
}

export type FollowAction = 'dragged' | 'locate' | 'reset';

/**
 * How the map follows the athlete. Dragging the map away stops it; the locate button brings it
 * back, and tapped again while following it swaps between north-up and heading-up.
 */
export function nextFollow(state: FollowState, action: FollowAction): FollowState {
  switch (action) {
    case 'dragged':
      return state.following ? { ...state, following: false } : state;
    case 'reset':
      return state.following ? state : { ...state, following: true };
    case 'locate':
      return state.following
        ? { following: true, mode: state.mode === 'north' ? 'heading' : 'north' }
        : { ...state, following: true };
  }
}

/** The locate button's icon: outline when the map has been dragged away, then one per follow mode. */
export function locateIcon({ following, mode }: FollowState): keyof typeof Ionicons.glyphMap {
  if (!following) return 'locate-outline';
  return mode === 'heading' ? 'navigate' : 'locate';
}
