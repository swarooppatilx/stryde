import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Gender } from '@/types';
import { DEFAULT_SETTINGS, type ProfileSettings } from '@/utils/profile';
import { asyncStorageAdapter, isoDateReviver } from '@/utils/storage';

interface ProfileState {
  username: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthday: string | null;
  wallet: string | null;
  privyUserId: string | null;
  profileId: string | null;
  avatar: string | null;
  avatarCid: string | null;
  createdAt: number | null;
  settings: ProfileSettings;
  setUsername: (username: string) => void;
  setFirstName: (firstName: string) => void;
  setLastName: (lastName: string) => void;
  setGender: (gender: Gender) => void;
  setBirthday: (birthday: string) => void;
  setWallet: (wallet: string) => void;
  setPrivyUserId: (privyUserId: string) => void;
  setProfileId: (profileId: string) => void;
  setAvatar: (avatar: string) => void;
  setAvatarCid: (cid: string) => void;
  updateSettings: (updates: Partial<ProfileSettings>) => void;
  reset: () => void;
  syncFromChain: (data: { username?: string; profileId: string; createdAt?: number }) => void;
}

const INITIAL_STATE = {
  username: '',
  firstName: '',
  lastName: '',
  gender: 'prefer_not_to_say' as Gender,
  birthday: null as string | null,
  wallet: null as string | null,
  privyUserId: null as string | null,
  profileId: null as string | null,
  avatar: null as string | null,
  avatarCid: null as string | null,
  createdAt: null as number | null,
  settings: DEFAULT_SETTINGS,
};

export function getCurrentUserId(): string {
  // Lazy import to avoid circular deps
  const { useProfileStore } = require('@/stores/profileStore');
  const state = useProfileStore.getState();
  return state.wallet || state.username || 'anonymous';
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,
      setUsername: (username) =>
        set({
          username,
          createdAt: get().createdAt ?? Date.now(),
        }),
      setFirstName: (firstName) => set({ firstName }),
      setLastName: (lastName) => set({ lastName }),
      setGender: (gender) => set({ gender }),
      setBirthday: (birthday) => set({ birthday }),
      setWallet: (wallet) => set({ wallet }),
      setPrivyUserId: (privyUserId) => set({ privyUserId }),
      setProfileId: (profileId) => set({ profileId }),
      setAvatar: (avatar) => set({ avatar }),
      setAvatarCid: (cid) => set({ avatarCid: cid }),
      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),
      reset: () => set(INITIAL_STATE),
      syncFromChain: (data) =>
        set((state) => ({
          profileId: data.profileId ?? state.profileId,
          createdAt: data.createdAt ?? state.createdAt,
        })),
    }),
    {
      name: '@stryde/profile',
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version === 1) {
          return {
            ...state,
            wallet: null,
            profileId: null,
            firstName: '',
            lastName: '',
            gender: 'prefer_not_to_say',
            birthday: null,
          };
        }
        if (version === 2) {
          return {
            ...state,
            firstName: (state.firstName as string) || '',
            lastName: (state.lastName as string) || '',
            gender: (state.gender as Gender) || 'prefer_not_to_say',
            birthday: (state.birthday as string) || null,
          };
        }
        return state;
      },
      storage: createJSONStorage(() => asyncStorageAdapter, { reviver: isoDateReviver }),
    }
  )
);
