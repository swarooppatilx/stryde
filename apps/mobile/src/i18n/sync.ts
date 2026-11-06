import { getLocales } from 'expo-localization';
import { setLanguage } from '@/i18n';
import { resolveLanguage } from '@/i18n/resolve';
import { useSettingsStore } from '@/stores/settingsStore';

function deviceLanguageCode(): string | null {
  return getLocales()[0]?.languageCode ?? null;
}

function apply(): void {
  setLanguage(resolveLanguage(useSettingsStore.getState().language, deviceLanguageCode()));
}

apply();
useSettingsStore.subscribe(apply);
