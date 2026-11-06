import type { Href } from 'expo-router';
import {
  isEnabled,
  NOTIFICATION_KINDS,
  type NotificationKind,
  type NotificationPrefs,
} from '@/stores/notificationPrefsStore';

/** What the server puts in a push's `data`: which kind of news it is, and the thing it is about. */
export interface PushPayload {
  kind: NotificationKind;
  id?: string;
}

export function parsePushPayload(data: unknown): PushPayload | null {
  if (typeof data !== 'object' || data === null) return null;
  const { kind, id } = data as Record<string, unknown>;
  const known = NOTIFICATION_KINDS.find((entry) => entry.kind === kind);
  if (!known) return null;
  return typeof id === 'string' && id.length > 0 ? { kind: known.kind, id } : { kind: known.kind };
}

const SCREEN_BY_KIND: Partial<
  Record<
    NotificationKind,
    '/activities/[id]' | '/athletes/[id]' | '/clubs/[id]' | '/challenges/[id]' | '/segment-detail'
  >
> = {
  kudos: '/activities/[id]',
  comments: '/activities/[id]',
  mentions: '/activities/[id]',
  friendActivities: '/activities/[id]',
  milestones: '/activities/[id]',
  newFollower: '/athletes/[id]',
  clubUpdates: '/clubs/[id]',
  challenges: '/challenges/[id]',
  segments: '/segment-detail',
};

/** The screen a tap on this notification opens; null when there is nowhere specific to go. */
export function routeForPush(payload: PushPayload): Href | null {
  const pathname = SCREEN_BY_KIND[payload.kind];
  if (!pathname || !payload.id) return null;
  // The segment screen reads its segment from `key`.
  if (pathname === '/segment-detail') return { pathname, params: { key: payload.id } };
  return { pathname, params: { id: payload.id } };
}

/** Whether to raise it while the app is open: unless the athlete turned this kind off. */
export function shouldShowPush(data: unknown, prefs?: NotificationPrefs): boolean {
  const payload = parsePushPayload(data);
  return payload ? isEnabled(payload.kind, prefs) : true;
}
