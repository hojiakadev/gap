import { isLanguage, type Language } from '../i18n/resources';
import type { ThemeMode } from '../app/theme';
const KEY = 'gap.preferences';
export interface Preferences {
  name: string;
  mode?: ThemeMode;
  language?: Language;
}
export function loadPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      name: typeof value?.name === 'string' ? value.name.slice(0, 32) : '',
      ...(isLanguage(value?.language) ? { language: value.language } : {}),
      ...(value?.mode === 'light' || value?.mode === 'dark' ? { mode: value.mode } : {}),
    };
  } catch {
    return { name: '' };
  }
}
export function savePreferences(preferences: Partial<Preferences>) {
  try {
    const previous = loadPreferences();
    localStorage.setItem(
      KEY,
      JSON.stringify({
        name: (preferences.name ?? previous.name).slice(0, 32),
        ...((preferences.language ?? previous.language)
          ? { language: preferences.language ?? previous.language }
          : {}),
        ...((preferences.mode ?? previous.mode) ? { mode: preferences.mode ?? previous.mode } : {}),
      }),
    );
  } catch {
    /* Private browsing can disable storage. */
  }
}
