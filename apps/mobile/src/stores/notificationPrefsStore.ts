import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorageAdapter } from '@/utils/storage';

export type NotificationKind =
  | 'newFollower'
  | 'kudos'
  | 'comments'
  | 'mentions'
  | 'friendActivities'
  | 'clubUpdates'
  | 'challenges'
  | 'milestones'
  | 'segments'
  | 'goalReached'
  | 'streakAtRisk'
  | 'weeklySummary'
  | 'recordingNotice'
  | 'uploadFailure';

export interface NotificationKindInfo {
  kind: NotificationKind;
  label: string;
  /** Raised on this phone alone, not by other people's activity. */
  local: boolean;
}

export const NOTIFICATION_KINDS: readonly NotificationKindInfo[] = [
  { kind: 'newFollower', label: 'New follower', local: false },
  { kind: 'kudos', label: 'Kudos', local: false },
  { kind: 'comments', label: 'Comments', local: false },
  { kind: 'mentions', label: 'Mentions', local: false },
  { kind: 'friendActivities', label: "Friends' activities", local: false },
  { kind: 'clubUpdates', label: 'Club posts and events', local: false },
  { kind: 'challenges', label: 'Challenge invites and progress', local: false },
  { kind: 'milestones', label: 'Milestones and badges', local: false },
  { kind: 'segments', label: 'Segment records', local: false },
  { kind: 'goalReached', label: 'Goal reached', local: false },
  { kind: 'streakAtRisk', label: 'Streak at risk', local: false },
  { kind: 'weeklySummary', label: 'Weekly summary', local: false },
  { kind: 'recordingNotice', label: 'Recording notice', local: true },
  { kind: 'uploadFailure', label: 'Upload failure', local: true },
];

export type NotificationPrefs = Record<NotificationKind, boolean>;

const allOn = (): NotificationPrefs =>
  Object.fromEntries(NOTIFICATION_KINDS.map(({ kind }) => [kind, true])) as NotificationPrefs;

/** Stored data made whole: unknown keys dropped, anything missing or not a boolean back on. */
export function sanitizePrefs(stored: unknown): NotificationPrefs {
  const source =
    typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
  const prefs = allOn();
  for (const { kind } of NOTIFICATION_KINDS) {
    const value = source[kind];
    if (typeof value === 'boolean') prefs[kind] = value;
  }
  return prefs;
}

export function enabledCount(prefs: NotificationPrefs): number {
  return NOTIFICATION_KINDS.filter(({ kind }) => prefs[kind]).length;
}

interface NotificationPrefsState {
  prefs: NotificationPrefs;
  setEnabled: (kind: NotificationKind, enabled: boolean) => void;
  reset: () => void;
}

/** Which notifications the athlete wants once the phone allows them; this device only. */
export const useNotificationPrefsStore = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      prefs: allOn(),
      setEnabled: (kind, enabled) => set((s) => ({ prefs: { ...s.prefs, [kind]: enabled } })),
      reset: () => set({ prefs: allOn() }),
    }),
    {
      name: '@stryde/notification-prefs',
      version: 1,
      storage: createJSONStorage(() => asyncStorageAdapter),
      migrate: (persisted) => ({
        prefs: sanitizePrefs((persisted as { prefs?: unknown } | null)?.prefs),
      }),
      merge: (persisted, current) => ({
        ...current,
        prefs: sanitizePrefs((persisted as { prefs?: unknown } | null)?.prefs),
      }),
    }
  )
);

/** Whether this kind may be raised; delivery asks this before it posts anything. */
export function isEnabled(
  kind: NotificationKind,
  prefs: NotificationPrefs = useNotificationPrefsStore.getState().prefs
): boolean {
  return prefs[kind] !== false;
}
