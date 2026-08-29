import { useState, useEffect, useCallback } from 'react';
import { ThemeId, getTheme, DEFAULT_THEME_ID } from '../themes/themes';

const STORAGE_KEY = 'subnetstudio-theme';

/** Apply a theme's CSS variables to the document root immediately */
function applyTheme(theme: ThemeDef) {
  const root = document.documentElement;
  for (const [key, val] of Object.entries(theme.vars)) {
    root.style.setProperty(key, val);
  }
  // Also stamp a data-theme attribute for future CSS selector hooks
  root.setAttribute('data-theme', theme.id);
}

export function useTheme() {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    return saved ?? DEFAULT_THEME_ID;
  });

  const theme = getTheme(themeId);

  // Apply CSS variables whenever theme changes (and on first mount)
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((id: ThemeId) => {
    localStorage.setItem(STORAGE_KEY, id);
    setThemeIdState(id);
  }, []);

  return { themeId, theme, setTheme };
}
