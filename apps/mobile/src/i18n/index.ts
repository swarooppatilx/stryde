import i18next from 'i18next';
import { useSyncExternalStore } from 'react';
import { en } from '@/i18n/locales/en';
import { hi } from '@/i18n/locales/hi';
import { isLanguage, type Language } from '@/i18n/resolve';
import type { TFunction, TKey, TParams } from '@/i18n/types';

export type { Language, LanguageSetting } from '@/i18n/resolve';
export type { TFunction, TKey } from '@/i18n/types';

// Plurals use `_one` / `_other` keys, which i18next picks with Intl.PluralRules; Hermes on Android ships it.
void i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'hi'],
  resources: { en: { translation: en }, hi: { translation: hi } },
  interpolation: { escapeValue: false },
  initAsync: false,
});

export function currentLanguage(): Language {
  return isLanguage(i18next.language) ? i18next.language : 'en';
}

export function setLanguage(language: Language): void {
  if (language !== i18next.language) void i18next.changeLanguage(language);
}

const bound = new Map<Language, TFunction>();

/** One function per language, so its identity changes exactly when the language does. */
function tFor(language: Language): TFunction {
  const existing = bound.get(language);
  if (existing) return existing;
  const fixed = i18next.getFixedT(language);
  const fn: TFunction = (key: TKey, params?: TParams) => fixed(key, params);
  bound.set(language, fn);
  return fn;
}

/** A translate function fixed to one language. */
export const getT = tFor;

/** Outside a component: reads the language at call time. */
export const t: TFunction = (key, params) => tFor(currentLanguage())(key, params);

function subscribe(onChange: () => void): () => void {
  i18next.on('languageChanged', onChange);
  return () => i18next.off('languageChanged', onChange);
}

/** The translate function for the current language; the component re-renders when it changes. */
export function useT(): TFunction {
  return tFor(useSyncExternalStore(subscribe, currentLanguage, () => 'en'));
}
