import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS, type ProfileSettings } from '@/utils/profile';
import { asyncStorageAdapter, isoDateReviver } from '@/utils/storage';

interface ProfileState {
  username: string;
  wallet: string | null;
  profileId: string | null;
  avatar: string | null;
  avatarCid: string | null;
  createdAt: number | null;
  settings: ProfileSettings;
  setUsername: (username: string) => void;
  setWallet: (wallet: string) => void;
  setProfileId: (profileId: string) => void;
  setAvatar: (avatar: string) => void;
  setAvatarCid: (cid: string) => void;
  updateSettings: (updates: Partial<ProfileSettings>) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  username: '',
  wallet: null as string | null,
  profileId: null as string | null,
  avatar: null as string | null,
  avatarCid: null as string | null,
  createdAt: null as number | null,
  settings: DEFAULT_SETTINGS,
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,
      setUsername: (username) =>
        set({
          username,
          createdAt: get().createdAt ?? Date.now(),
        }),
      setWallet: (wallet) => set({ wallet }),
      setProfileId: (profileId) => set({ profileId }),
      setAvatar: (avatar) => set({ avatar }),
      setAvatarCid: (cid) => set({ avatarCid: cid }),
      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: '@onchainstrava/profile',
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version === 1) {
          return {
            ...state,
            wallet: null,
            profileId: null,
          };
        }
        return state;
      },
      storage: createJSONStorage(() => asyncStorageAdapter, { reviver: isoDateReviver }),
    }
  )
);
