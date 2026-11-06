export const LANGUAGES = ['en', 'hi'] as const;
export type Language = (typeof LANGUAGES)[number];
export type LanguageSetting = 'system' | Language;

export const LANGUAGE_SETTINGS: readonly LanguageSetting[] = ['system', ...LANGUAGES];

export function isLanguage(code: unknown): code is Language {
  return LANGUAGES.some((l) => l === code);
}

export function isLanguageSetting(value: unknown): value is LanguageSetting {
  return value === 'system' || isLanguage(value);
}

/** The explicit choice, else the phone's language when it is bundled, else English. */
export function resolveLanguage(
  setting: LanguageSetting,
  deviceCode: string | null | undefined
): Language {
  if (setting !== 'system') return setting;
  return isLanguage(deviceCode) ? deviceCode : 'en';
}
