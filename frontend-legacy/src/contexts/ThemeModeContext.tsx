/** ThemeModeContext v1.1.0 — chave velohub-theme + data-theme */
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { CssBaseline, PaletteMode, ThemeProvider } from '@mui/material';
import { createVelodeskTheme } from '../theme/velodeskTheme';

const STORAGE_KEY = 'velohub-theme';
const LEGACY_KEY = 'velodeskDarkMode';

interface ThemeModeContextValue {
  mode: PaletteMode;
  toggleMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function readStoredMode(): PaletteMode {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;

  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy === '1') return 'dark';
  if (legacy === '0') return 'light';

  return 'light';
}

function applyThemeMode(mode: PaletteMode) {
  const isDark = mode === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem(STORAGE_KEY, mode);
  localStorage.setItem(LEGACY_KEY, isDark ? '1' : '0');
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(readStoredMode);
  const theme = useMemo(() => createVelodeskTheme(mode), [mode]);

  useEffect(() => {
    applyThemeMode(mode);
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      toggleMode: () => setMode((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode deve ser usado dentro de ThemeModeProvider');
  return ctx;
}
