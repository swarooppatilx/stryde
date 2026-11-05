export type BackWhileRecording = 'ignore' | 'ask';

/**
 * What the Back button does on a live recording. It never silently leaves (the tab bar is hidden, so
 * Back was the way out and a stray press walked off a running activity): a locked screen swallows it,
 * a finish already under way swallows it, and otherwise the athlete is asked.
 */
export function backWhileRecording(state: {
  locked: boolean;
  finishing: boolean;
}): BackWhileRecording {
  return state.locked || state.finishing ? 'ignore' : 'ask';
}
