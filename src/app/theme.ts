import { createTheme } from '@mui/material/styles';
export type ThemeMode = 'light' | 'dark';
export function createGapTheme(mode: ThemeMode) {
  const dark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#59d6c2' : '#087f72', contrastText: dark ? '#092a25' : '#ffffff' },
      background: { default: dark ? '#111a1d' : '#f3f7f7', paper: dark ? '#192528' : '#ffffff' },
      text: { primary: dark ? '#e5efed' : '#172e2b', secondary: dark ? '#a3b7b3' : '#607772' },
      divider: dark ? '#30413f' : '#dce7e4',
      error: { main: dark ? '#f29ca6' : '#bc4454' },
    },
    typography: {
      fontFamily: '"Roboto", "Arial", sans-serif',
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '-0.1px' },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 9, padding: '10px 16px' } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { fontSize: 14 },
          notchedOutline: { borderColor: dark ? '#3e5550' : '#ccded8' },
        },
      },
      MuiTooltip: { defaultProps: { arrow: true } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 18, padding: 8 } } },
    },
  });
}
