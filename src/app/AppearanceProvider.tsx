import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createGapTheme, type ThemeMode } from './theme';
import { loadPreferences, savePreferences } from '../lib/preferences';
const AppearanceContext = createContext<{ mode: ThemeMode; toggleMode: () => void } | null>(null);
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(
    () =>
      loadPreferences().mode ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
  const theme = useMemo(() => createGapTheme(mode), [mode]);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'dark' ? '#111a1d' : '#f3f7f7');
  }, [mode]);
  const toggleMode = () => {
    const next = mode === 'light' ? 'dark' : 'light';
    savePreferences({ mode: next });
    setMode(next);
  };
  return (
    <AppearanceContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppearanceContext.Provider>
  );
}
export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('AppearanceProvider is required.');
  return context;
}
