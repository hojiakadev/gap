import en from './locales/en.json';
import uz from './locales/uz.json';
import ru from './locales/ru.json';
export const LANGUAGES = ['uz', 'en', 'ru'] as const;
export type Language = (typeof LANGUAGES)[number];
export const isLanguage = (value: unknown): value is Language =>
  LANGUAGES.some((language) => language === value);
// Compile-time parity: every catalog must translate all English keys.
const uzCatalog: Record<keyof typeof en, string> = uz;
const ruCatalog: Record<keyof typeof en, string> = ru;
export const resources = {
  en: { translation: en },
  uz: { translation: uzCatalog },
  ru: { translation: ruCatalog },
};
export const languageNames: Record<Language, string> = {
  uz: 'O‘zbekcha',
  en: 'English',
  ru: 'Русский',
};
export const locales: Record<Language, string> = { uz: 'uz-UZ', en: 'en-US', ru: 'ru-RU' };
export function detectLanguage(saved: unknown, browserLanguages: readonly string[]): Language {
  if (isLanguage(saved)) return saved;
  for (const language of browserLanguages) {
    const base = language.toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return 'en';
}
