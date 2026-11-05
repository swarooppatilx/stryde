import type { Speaker } from '@/platform/ports';

/**
 * Spoken announcements through `expo-speech`. The module is loaded on first use and every call
 * is guarded: a build made before the native module was added stays silent instead of crashing.
 */
type Lib = typeof import('expo-speech');

function loadLib(): Lib | null {
  try {
    return require('expo-speech') as Lib;
  } catch {
    return null;
  }
}

export const expoSpeaker: Speaker = {
  speak(text) {
    try {
      loadLib()?.speak(text);
    } catch {
      // Best effort: a failed announcement must never disturb a recording.
    }
  },
  stop() {
    try {
      void loadLib()?.stop();
    } catch {
      // Same: nothing to cut off.
    }
  },
};
