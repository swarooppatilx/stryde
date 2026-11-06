import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LanguageSetting } from '@/i18n/resolve';
import { getPlatform } from '@/platform';
import type { ActivityPrivacy, ActivityType, HiddenStat, PrivacyZone } from '@/types';
import type { AudioCueInterval } from '@/utils/audioCue';
import {
  DEFAULT_LIVE_STAT_SLOTS,
  type LiveStatFamily,
  type LiveStatId,
  type LiveStatSlots,
  sanitizeLiveStatSlots,
  withLiveStatSlot,
} from '@/utils/liveStats';
import type { MotionPreference } from '@/utils/motionPreference';
import { sanitizePreferredSports } from '@/utils/preferredSports';
import { sanitizeHiddenStats } from '@/utils/privacyDefaults';
import type { StartTab } from '@/utils/startTab';
import { asyncStorageAdapter, isoDateReviver } from '@/utils/storage';
import type { WeekStartDay } from '@/utils/trainingLog';

/** More places than this is a list nobody keeps up; the oldest drop off. */
export const MAX_PRIVACY_ZONES = 10;

export type AccuracyMode = 'best' | 'balanced' | 'power';

export const ACCURACY_MODES: AccuracyMode[] = ['best', 'balanced', 'power'];

/** Seconds counted down before recording starts; 0 starts at once. */
export const COUNTDOWN_OPTIONS = [0, 3, 5, 10] as const;
export type CountdownSeconds = (typeof COUNTDOWN_OPTIONS)[number];

/** Seconds of no touch before the screen dims while recording; 0 never dims. */

/** Per-mode location sampling contract used by the tracking screen. */
export const ACCURACY_MODE_CONFIG: Record<
  AccuracyMode,
  { label: string; caption: string; timeInterval: number }
> = {
  best: {
    label: 'Best',
    caption: 'Highest fidelity, uses the most battery',
    timeInterval: 1000,
  },
  balanced: {
    label: 'Balanced',
    caption: 'Good accuracy with moderate battery drain',
    timeInterval: 3000,
  },
  power: {
    label: 'Low-power',
    caption: 'Coarse fixes that maximize battery life',
    timeInterval: 5000,
  },
};

interface SettingsState {
  useGyroscopeAssist: boolean;
  /** Pause by itself when a ride (or any sport that is not on foot) stops moving. */
  autoPause: boolean;
  /** The same for runs, walks and hikes, which a phone in the hand reads less reliably. */
  autoPauseOnFoot: boolean;
  /** How often distance is said aloud while recording: never, each kilometre (or mile), or each half. */
  audioCueInterval: AudioCueInterval;
  /** Hold the screen awake while recording. */
  keepScreenOn: boolean;
  /** Start the paired Apple Watch's workout with each recording and use its readings. */
  useAppleWatch: boolean;
  /** How long the screen stays bright without a touch while it is held awake; 0 never dims. */
  /** Say aloud when a run starts, pauses, resumes and stops, and how each lap went. */
  announceActions: boolean;
  /** Trade-off between GPS fix quality and battery life while tracking. */
  accuracyMode: AccuracyMode;
  /** Step the GPS down a notch in battery saver or on a nearly flat battery. */
  adjustGpsInBatterySaver: boolean;
  /** Leave the first and last stretch out of the route other people can see. */
  hideRouteEnds: boolean;
  /** A new activity starts with its route map hidden from others; the save form can still change it. */
  defaultHideRoute: boolean;
  /** Figures a new activity starts with hidden from others. */
  defaultHiddenStats: HiddenStat[];
  /** A new activity starts muted from Home and club feeds. */
  defaultMutedFromFeeds: boolean;
  /** Who can see a new activity unless the athlete picks otherwise when saving it. */
  defaultPrivacy: ActivityPrivacy;
  /** The tab the app opens on at launch. */
  startTab: StartTab;
  /** The day a week begins on, for This Week, the calendar and the weekly charts. */
  weekStartsOn: WeekStartDay;
  /** Whether animation follows the phone's setting or is always kept to a minimum. */
  motion: MotionPreference;
  /** The app's language: the phone's, or one picked here. */
  language: LanguageSetting;
  /** Places whose surroundings are cut from the route others see; this device only. */
  privacyZones: PrivacyZone[];
  countdownSeconds: CountdownSeconds;
  /** The figure in each slot of the Record screen, one layout for pace sports and one for speed. */
  liveStatSlots: LiveStatSlots;
  /** Sports picked at setup, in the order picked; they lead the Record shortcuts until history takes over. */
  preferredSports: ActivityType[];
  // Survives logout (unlike profileStore, which is cleared) so a returning
  // user who signs out lands on /login, not back through the full onboarding
  // carousel — that's only for people who have never authenticated before.
  hasOnboarded: boolean;
  /** Publish a short-lived live location beacon (Arkiv) while recording. */
  liveBeacon: boolean;
  /** Encrypt the archived GPX on Swarm so only you can open it. */
  privateRoutes: boolean;
  /** Read heart rate/steps from Health Connect or HealthKit after each activity. */
  healthData: boolean;
  /** Log every GPS fix, step count and pause decision while recording, for diagnosing tracking. */
  verboseTrackingLog: boolean;
  setVerboseTrackingLog: (enabled: boolean) => void;
  setLiveBeacon: (enabled: boolean) => void;
  setPrivateRoutes: (enabled: boolean) => void;
  setHealthData: (enabled: boolean) => void;
  setGyroscopeAssist: (enabled: boolean) => void;
  setAutoPause: (enabled: boolean) => void;
  setAutoPauseOnFoot: (enabled: boolean) => void;
  setAudioCueInterval: (interval: AudioCueInterval) => void;
  setAnnounceActions: (enabled: boolean) => void;
  setKeepScreenOn: (enabled: boolean) => void;
  setUseAppleWatch: (enabled: boolean) => void;
  setAccuracyMode: (mode: AccuracyMode) => void;
  setAdjustGpsInBatterySaver: (enabled: boolean) => void;
  setHideRouteEnds: (enabled: boolean) => void;
  setDefaultPrivacy: (privacy: ActivityPrivacy) => void;
  setDefaultHideRoute: (enabled: boolean) => void;
  setDefaultHiddenStat: (stat: HiddenStat, hidden: boolean) => void;
  setDefaultMutedFromFeeds: (enabled: boolean) => void;
  setStartTab: (tab: StartTab) => void;
  setWeekStartsOn: (day: WeekStartDay) => void;
  setMotion: (motion: MotionPreference) => void;
  setLanguage: (language: LanguageSetting) => void;
  addPrivacyZone: (zone: Omit<PrivacyZone, 'id'>) => PrivacyZone;
  removePrivacyZone: (id: string) => void;
  setCountdownSeconds: (seconds: CountdownSeconds) => void;
  setLiveStatSlot: (family: LiveStatFamily, slot: number, id: LiveStatId) => void;
  setPreferredSports: (sports: ActivityType[]) => void;
  setHasOnboarded: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  useGyroscopeAssist: true,
  hasOnboarded: false,
  autoPause: true,
  autoPauseOnFoot: false,
  audioCueInterval: 'off' as AudioCueInterval,
  announceActions: false,
  keepScreenOn: true,
  useAppleWatch: true,
  // 1 s fixes: coarser sampling made distance and pace noticeably worse on winding routes.
  accuracyMode: 'best' as AccuracyMode,
  adjustGpsInBatterySaver: true,
  hideRouteEnds: false,
  defaultHideRoute: false,
  defaultHiddenStats: [] as HiddenStat[],
  defaultMutedFromFeeds: false,
  defaultPrivacy: 'everyone' as ActivityPrivacy,
  startTab: 'index' as StartTab,
  weekStartsOn: 0 as WeekStartDay,
  motion: 'auto' as MotionPreference,
  language: 'system' as LanguageSetting,
  privacyZones: [] as PrivacyZone[],
  countdownSeconds: 3 as CountdownSeconds,
  liveStatSlots: DEFAULT_LIVE_STAT_SLOTS,
  preferredSports: [] as ActivityType[],
  liveBeacon: false,
  privateRoutes: false,
  healthData: false,
  verboseTrackingLog: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,
      setGyroscopeAssist: (enabled) => set({ useGyroscopeAssist: enabled }),
      setAutoPause: (enabled) => set({ autoPause: enabled }),
      setAutoPauseOnFoot: (enabled) => set({ autoPauseOnFoot: enabled }),
      setAudioCueInterval: (interval) => set({ audioCueInterval: interval }),
      setAnnounceActions: (enabled) => set({ announceActions: enabled }),
      setKeepScreenOn: (enabled) => set({ keepScreenOn: enabled }),
      setUseAppleWatch: (enabled) => set({ useAppleWatch: enabled }),
      setAccuracyMode: (mode) => set({ accuracyMode: mode }),
      setAdjustGpsInBatterySaver: (enabled) => set({ adjustGpsInBatterySaver: enabled }),
      setHideRouteEnds: (enabled) => set({ hideRouteEnds: enabled }),
      setDefaultPrivacy: (privacy) => set({ defaultPrivacy: privacy }),
      setDefaultHideRoute: (enabled) => set({ defaultHideRoute: enabled }),
      setDefaultHiddenStat: (stat, hidden) =>
        set((state) => ({
          defaultHiddenStats: sanitizeHiddenStats(
            hidden
              ? [...state.defaultHiddenStats, stat]
              : state.defaultHiddenStats.filter((s) => s !== stat)
          ),
        })),
      setDefaultMutedFromFeeds: (enabled) => set({ defaultMutedFromFeeds: enabled }),
      setStartTab: (tab) => set({ startTab: tab }),
      setWeekStartsOn: (day) => set({ weekStartsOn: day }),
      setMotion: (motion) => set({ motion }),
      setLanguage: (language) => set({ language }),
      addPrivacyZone: (input) => {
        const zone: PrivacyZone = {
          id: getPlatform().ids.next(),
          name: input.name.trim(),
          latitude: input.latitude,
          longitude: input.longitude,
          radius: input.radius,
        };
        set((state) => ({ privacyZones: [...state.privacyZones, zone].slice(-MAX_PRIVACY_ZONES) }));
        return zone;
      },
      removePrivacyZone: (id) =>
        set((state) => ({ privacyZones: state.privacyZones.filter((z) => z.id !== id) })),
      setCountdownSeconds: (seconds) => set({ countdownSeconds: seconds }),
      setLiveStatSlot: (family, slot, id) =>
        set((state) => ({
          liveStatSlots: withLiveStatSlot(state.liveStatSlots, family, slot, id),
        })),
      setPreferredSports: (sports) => set({ preferredSports: sanitizePreferredSports(sports) }),
      setHasOnboarded: () => set({ hasOnboarded: true }),
      setLiveBeacon: (enabled) => set({ liveBeacon: enabled }),
      setPrivateRoutes: (enabled) => set({ privateRoutes: enabled }),
      setHealthData: (enabled) => set({ healthData: enabled }),
      setVerboseTrackingLog: (enabled) => set({ verboseTrackingLog: enabled }),
      // Keeps `hasOnboarded`: it is not a preference, and clearing it would send a returning user back through the first-run carousel.
      reset: () => set({ ...INITIAL_STATE, hasOnboarded: get().hasOnboarded }),
    }),
    {
      name: '@stryde/settings',
      version: 15,
      storage: createJSONStorage(() => asyncStorageAdapter, { reviver: isoDateReviver }),
      migrate: (persistedState: unknown, version: number) => {
        let state = persistedState as Record<string, unknown>;
        if (version < 1) {
          state = {
            ...state,
            useGyroscopeAssist: state.useGyroscopeAssist ?? true,
          };
        }
        if (version < 2) {
          state = { ...state, autoPause: true };
        }
        if (version < 3) {
          state = { ...state, accuracyMode: 'balanced' };
        }
        if (version < 4) {
          state = { ...state, countdownSeconds: 3 };
        }
        if (version < 5 && state.accuracyMode === 'balanced') {
          // Balanced was only ever the default applied to everyone; move it to the better one.
          state = { ...state, accuracyMode: 'best' };
        }
        if (version < 6) {
          // One switch became two: whoever had it on or off keeps that for runs as well.
          state = { ...state, autoPauseOnFoot: state.autoPause ?? true };
        }
        if (version < 7) {
          // The cue switch became a choice of how often; on always meant each whole kilometre or mile.
          // The old key is dropped so it does not linger in the store next to its replacement.
          const { audioCues, ...rest } = state;
          state = { ...rest, audioCueInterval: audioCues === true ? 'unit' : 'off' };
        }
        if (version < 8) {
          // The Record screen's figures became a choice; older installs get the screen they knew.
          state = { ...state, liveStatSlots: sanitizeLiveStatSlots(state.liveStatSlots) };
        }
        if (version < 9) {
          // The sensor rate is fixed in code now, so the saved choice is dropped.
          const { sensorUpdateRate, ...rest } = state;
          state = rest;
        }
        if (version < 10) {
          state = { ...state, preferredSports: [] };
        }
        if (version < 11) {
          state = { ...state, liveBeacon: false, privateRoutes: false, healthData: false };
        }
        if (version < 12) {
          state = { ...state, verboseTrackingLog: true };
        }
        if (version < 13) {
          state = {
            ...state,
            defaultHideRoute: false,
            defaultHiddenStats: [],
            defaultMutedFromFeeds: false,
          };
        }
        if (version < 14) {
          state = { ...state, adjustGpsInBatterySaver: true };
        }
        if (version < 15) {
          state = { ...state, language: 'system' };
        }
        return state;
      },
    }
  )
);
