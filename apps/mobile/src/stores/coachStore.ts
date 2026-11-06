import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CoachDebrief, CoachPlan, CoachReview, ZeroGReceipt } from '@/services/coachService';
import { chainScopedStorageAdapter } from '@/utils/storage';

export interface SavedPlan {
  /** Local day the plan is for, `YYYY-MM-DD`. */
  day: string;
  plan: CoachPlan;
  receipts: ZeroGReceipt[];
  createdAt: number;
}

export interface SavedPoster {
  /** `file://` URI in the app's documents directory. */
  uri: string;
  /** The art director's name for the poster; absent for posters made before it existed. */
  title?: string | null;
  style?: string;
  receipts: ZeroGReceipt[];
  createdAt: number;
}

export interface SavedDebrief extends CoachDebrief {
  transcript: string;
  receipts: ZeroGReceipt[];
  createdAt: number;
}

export interface SavedReview {
  review: CoachReview;
  receipts: ZeroGReceipt[];
  createdAt: number;
}

interface CoachState {
  plans: Record<string, SavedPlan>;
  posters: Record<string, SavedPoster>;
  debriefs: Record<string, SavedDebrief>;
  reviews: Record<string, SavedReview>;
  savePlan: (plan: SavedPlan) => void;
  savePoster: (activityId: string, poster: SavedPoster) => void;
  saveDebrief: (activityId: string, debrief: SavedDebrief) => void;
  saveReview: (activityId: string, review: SavedReview) => void;
  reset: () => void;
}

const PLAN_DAYS_KEPT = 30;
const INITIAL = { plans: {}, posters: {}, debriefs: {}, reviews: {} };

export const useCoachStore = create<CoachState>()(
  persist(
    (set) => ({
      ...INITIAL,
      savePlan: (plan) =>
        set((s) => {
          const plans = { ...s.plans, [plan.day]: plan };
          const days = Object.keys(plans).sort().reverse();
          for (const old of days.slice(PLAN_DAYS_KEPT)) delete plans[old];
          return { plans };
        }),
      savePoster: (activityId, poster) =>
        set((s) => ({ posters: { ...s.posters, [activityId]: poster } })),
      saveDebrief: (activityId, debrief) =>
        set((s) => ({ debriefs: { ...s.debriefs, [activityId]: debrief } })),
      saveReview: (activityId, review) =>
        set((s) => ({ reviews: { ...s.reviews, [activityId]: review } })),
      reset: () => set(INITIAL),
    }),
    {
      name: '@stryde/coach',
      version: 1,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
      partialize: (s) => ({
        plans: s.plans,
        posters: s.posters,
        debriefs: s.debriefs,
        reviews: s.reviews,
      }),
    }
  )
);
