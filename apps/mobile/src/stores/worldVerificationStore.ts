import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AthletePass, PresenceTicket } from '@/types/worldId';
import { chainScopedStorageAdapter } from '@/utils/storage';

interface WorldVerificationState {
  isVerified: boolean;
  verifiedAt: number | null;
  nullifier: string | null;
  /** The server's Athlete Pass for this wallet; the server stays the authority on what it unlocks. */
  pass: AthletePass | null;
  /** Finish-Line proofs by activity hash (lowercase): the runs a human vouched for. */
  tickets: Record<string, PresenceTicket>;
  setVerified: (nullifier: string) => void;
  setPass: (pass: AthletePass | null) => void;
  addTicket: (ticket: PresenceTicket) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  isVerified: false,
  verifiedAt: null as number | null,
  nullifier: null as string | null,
  pass: null as AthletePass | null,
  tickets: {} as Record<string, PresenceTicket>,
};

export const useWorldVerificationStore = create<WorldVerificationState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setVerified: (nullifier) =>
        set({
          isVerified: true,
          verifiedAt: Date.now(),
          nullifier,
        }),
      setPass: (pass) =>
        set((state) =>
          pass
            ? {
                pass,
                isVerified: true,
                verifiedAt: state.verifiedAt ?? pass.enrolledAt,
              }
            : { pass: null }
        ),
      addTicket: (ticket) =>
        set((state) => ({
          tickets: { ...state.tickets, [ticket.activityHash.toLowerCase()]: ticket },
        })),
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: '@stryde/world-verification',
      version: 2,
      migrate: (persisted) => ({ ...INITIAL_STATE, ...(persisted as object) }),
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);
