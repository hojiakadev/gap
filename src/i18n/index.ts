import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { loadPreferences, savePreferences } from '../lib/preferences';
import { detectLanguage, isLanguage, LANGUAGES, locales, resources } from './resources';
export const i18n = createInstance();
void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(loadPreferences().language, navigator.languages ?? [navigator.language]),
  supportedLngs: [...LANGUAGES],
  fallbackLng: 'en',
  keySeparator: false,
  nsSeparator: false,
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});
function updateDocument() {
  const language = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en';
  document.documentElement.lang = language;
  document.title = i18n.t('Page title');
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', i18n.t('Page description'));
}
i18n.on('languageChanged', (language) => {
  if (isLanguage(language)) savePreferences({ language });
  updateDocument();
});
updateDocument();
export const currentLocale = () =>
  locales[isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en'];
/** Relay errors stay language-neutral on the wire and are localized per recipient. */
export const localizeNotice = (message: string) =>
  i18n.exists(message) ? i18n.t(message) : message;
