import type { Ionicons } from '@expo/vector-icons';

import type { ActivityFeel, ActivityType } from '@/types';

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

export const FEEL_OPTIONS: { value: ActivityFeel; emoji: string; label: string }[] = [
  { value: 'great', emoji: '😍', label: 'Great' },
  { value: 'good', emoji: '😊', label: 'Good' },
  { value: 'ok', emoji: '😐', label: 'OK' },
  { value: 'bad', emoji: '😕', label: 'Bad' },
  { value: 'terrible', emoji: '😫', label: 'Terrible' },
];

export function getSportIcon(type: ActivityType | undefined): keyof typeof Ionicons.glyphMap {
  return (type && SPORT_ICONS[type]) || 'walk';
}
