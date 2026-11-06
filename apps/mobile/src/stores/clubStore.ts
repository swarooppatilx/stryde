import { type ClubAction, type ClubPost, type ClubState, services } from '@repo/shared';
import { create } from 'zustand';
import { logger } from '@/utils/logger';

export interface ClubView {
  state: ClubState | null;
  feed: ClubPost[];
  loading: boolean;
  error: string | null;
}

const EMPTY: ClubView = { state: null, feed: [], loading: false, error: null };

/** A change made on this device, shown at once while the outbox delivers it. */
export interface ClubChange {
  clubId: string;
  action: ClubAction;
  target?: string;
  data?: Record<string, unknown>;
  clientId?: string;
}

interface ClubStoreState {
  clubs: Record<string, ClubView>;
  view(clubId: string): ClubView;
  /** Fetches the club's settings, roles, requests and feed. */
  load(clubId: string): Promise<void>;
  /** Applies a change to what is on screen before the server confirms it. */
  applyLocal(change: ClubChange, me: `0x${string}`): void;
}

/** Club feed and running state from the club API, per club. Not saved: always fetched fresh. */
export const useClubStore = create<ClubStoreState>()((set, get) => {
  const patch = (clubId: string, update: (view: ClubView) => Partial<ClubView>) =>
    set((s) => {
      const current = s.clubs[clubId] ?? EMPTY;
      return { clubs: { ...s.clubs, [clubId]: { ...current, ...update(current) } } };
    });

  return {
    clubs: {},
    view: (clubId) => get().clubs[clubId] ?? EMPTY,

    async load(clubId) {
      patch(clubId, () => ({ loading: true, error: null }));
      try {
        const [state, feed] = await Promise.all([
          services.clubs.getClubState(clubId),
          services.clubs.getClubFeed(clubId, 30),
        ]);
        patch(clubId, () => ({ state, feed, loading: false }));
      } catch (error) {
        logger.warn('[Clubs] Could not load the club', error);
        patch(clubId, () => ({ loading: false, error: 'Could not load the club' }));
      }
    },

    applyLocal(change, me) {
      patch(change.clubId, (view) => applyChange(view, change, me));
    },
  };
});

/** The view after a change, as the server will make it. Pure, for tests. */
export function applyChange(
  view: ClubView,
  change: ClubChange,
  me: `0x${string}`
): Partial<ClubView> {
  const now = Math.floor(Date.now() / 1000);
  const data = change.data ?? {};
  const state = view.state;
  const withState = (next: Partial<ClubState>) => (state ? { state: { ...state, ...next } } : {});
  switch (change.action) {
    case 'post':
      return {
        feed: [
          {
            id: `local-${change.clientId}`,
            author: me,
            text: String(data.text ?? ''),
            photos: (data.photos as string[] | undefined) ?? [],
            announcement: data.announcement === true,
            createdAt: now,
            comments: [],
          },
          ...view.feed,
        ],
      };
    case 'delete-post':
      return { feed: view.feed.filter((p) => p.id !== change.target) };
    case 'comment':
      return {
        feed: view.feed.map((p) =>
          p.id === change.target
            ? {
                ...p,
                comments: [
                  ...p.comments,
                  {
                    id: `local-${change.clientId}`,
                    postId: p.id,
                    author: me,
                    text: String(data.text ?? ''),
                    createdAt: now,
                  },
                ],
              }
            : p
        ),
      };
    case 'delete-comment':
      return {
        feed: view.feed.map((p) => ({
          ...p,
          comments: p.comments.filter((c) => c.id !== change.target),
        })),
      };
    case 'settings':
      return withState({
        settings: {
          ...(state?.settings ?? ({} as ClubState['settings'])),
          ...data,
        } as ClubState['settings'],
      });
    case 'set-role': {
      const target = change.target as `0x${string}`;
      const admins = (state?.admins ?? []).filter((a) => a !== target);
      return withState({ admins: data.role === 'admin' ? [...admins, target] : admins });
    }
    case 'request':
      return withState({
        requests: [
          ...(state?.requests ?? []).filter((r) => r.member !== me),
          { member: me, status: 'pending', at: now },
        ],
      });
    case 'cancel-request':
      return withState({ requests: (state?.requests ?? []).filter((r) => r.member !== me) });
    case 'decide':
      return withState({
        requests: (state?.requests ?? []).map((r) =>
          r.member === change.target ? { ...r, status: data.approve ? 'approved' : 'declined' } : r
        ),
      });
    case 'remove-member': {
      const target = change.target as `0x${string}`;
      const removed = (state?.removed ?? []).filter((r) => r !== target);
      return withState({
        removed: data.removed === false ? removed : [...removed, target],
        admins: (state?.admins ?? []).filter((a) => a !== target),
      });
    }
    case 'link-event':
      return withState({ events: [...new Set([...(state?.events ?? []), String(change.target)])] });
    case 'unlink-event':
      return withState({ events: (state?.events ?? []).filter((e) => e !== change.target) });
    default:
      return {};
  }
}
