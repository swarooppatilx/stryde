import type { Ionicons } from '@expo/vector-icons';

import { t as defaultT, type TFunction } from '@/i18n';
import type {
  ActivityEffort,
  ActivityFeel,
  ActivityPrivacy,
  ActivityType,
  HiddenStat,
} from '@/types';

export const SPORT_ICONS: Record<ActivityType, keyof typeof Ionicons.glyphMap> = {
  run: 'walk',
  ride: 'bicycle',
  walk: 'footsteps',
  hike: 'leaf',
  swim: 'water',
  yoga: 'body',
  workout: 'barbell',
  hiit: 'flash',
  dance: 'musical-notes',
  climb: 'trending-up',
  skate: 'swap-horizontal',
  row: 'boat',
};

export const SPORT_TYPES: {
  type: ActivityType;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  category: 'cardio' | 'strength' | 'mind' | 'sport';
}[] = [
  { type: 'run', icon: 'walk-outline', label: 'Run', category: 'cardio' },
  { type: 'ride', icon: 'bicycle-outline', label: 'Ride', category: 'cardio' },
  { type: 'walk', icon: 'footsteps-outline', label: 'Walk', category: 'cardio' },
  { type: 'hike', icon: 'leaf-outline', label: 'Hike', category: 'cardio' },
  { type: 'swim', icon: 'water-outline', label: 'Swim', category: 'sport' },
  { type: 'row', icon: 'boat-outline', label: 'Row', category: 'sport' },
  { type: 'skate', icon: 'swap-horizontal-outline', label: 'Skate', category: 'sport' },
  { type: 'yoga', icon: 'body-outline', label: 'Yoga', category: 'mind' },
  { type: 'dance', icon: 'musical-notes-outline', label: 'Dance', category: 'mind' },
  { type: 'workout', icon: 'barbell-outline', label: 'Workout', category: 'strength' },
  { type: 'hiit', icon: 'flash-outline', label: 'HIIT', category: 'strength' },
  { type: 'climb', icon: 'trending-up-outline', label: 'Climb', category: 'strength' },
];

/** Fastest plausible speed per sport; faster fixes are GPS glitches. */
export const MAX_SPEED_KMH: Record<ActivityType, number> = {
  run: 25,
  walk: 10,
  hike: 15,
  // 50 rejected real road-ride descents (60–80 km/h); fast descents can reach ~120.
  ride: 120,
  swim: 8,
  yoga: 5,
  workout: 10,
  hiit: 15,
  dance: 15,
  climb: 10,
  skate: 20,
  row: 15,
};

export const GPS_DISTANCE_SPORTS: ReadonlySet<ActivityType> = new Set<ActivityType>([
  'run',
  'ride',
  'walk',
  'hike',
  'skate',
  'row',
]);

export const FEEL_OPTIONS: { value: ActivityFeel; emoji: string; label: string }[] = [
  { value: 'great', emoji: '😍', label: 'Great' },
  { value: 'good', emoji: '😊', label: 'Good' },
  { value: 'ok', emoji: '😐', label: 'OK' },
  { value: 'bad', emoji: '😕', label: 'Bad' },
  { value: 'terrible', emoji: '😫', label: 'Terrible' },
];

export const EFFORT_OPTIONS: { value: ActivityEffort; label: string; description: string }[] = [
  { value: 'easy', label: 'Easy', description: 'You could talk the whole way.' },
  { value: 'moderate', label: 'Moderate', description: 'Breathing harder, still able to talk.' },
  { value: 'hard', label: 'Hard', description: 'Short sentences only.' },
  { value: 'max', label: 'Max effort', description: 'All out. You could not have kept it up.' },
];

export function getSportIcon(type: ActivityType | undefined): keyof typeof Ionicons.glyphMap {
  return (type && SPORT_ICONS[type]) || 'walk';
}

export function getSportLabel(type: ActivityType | undefined, t: TFunction = defaultT): string {
  return t(type && type in SPORT_ICONS ? `sport.${type}` : 'sport.other');
}

/** Who can see an activity, as the shared segmented choice lists it. */
/** What an author can keep from other people's view: only figures that are published at all (pace comes from the public distance and time). */
export const HIDDEN_STAT_OPTIONS: readonly { value: HiddenStat; label: string }[] = [
  { value: 'start_time', label: 'Start time' },
  { value: 'pace', label: 'Pace' },
];

export const PRIVACY_CHOICES: readonly { value: ActivityPrivacy; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'followers', label: 'Followers' },
  { value: 'only_me', label: 'Only Me' },
];
