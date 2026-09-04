import type { ColorSchemeName } from 'react-native';

import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useProfileStore } from '@/stores/profileStore';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

/** Resolve the effective mode from the user's stored preference, falling back to the OS scheme. */
export function resolveMode(preference: ThemePreference, scheme: ColorSchemeName): ThemeMode {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  return scheme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const preference = useProfileStore((s) => s.settings.theme);
  const scheme = useColorScheme();
  const mode = resolveMode(preference, scheme);

  return { ...Colors[mode], brand: Brand, mode, isDark: mode === 'dark' };
}
