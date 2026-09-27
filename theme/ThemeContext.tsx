import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { dark, light, type ThemeColors } from './tokens';
import { createAppStyles } from './appStyles';

type ThemeName = 'light' | 'dark';

type ThemeContextValue = {
  name: ThemeName;
  colors: ThemeColors;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  name: 'light',
  colors: light,
  toggle: () => undefined,
});

function applyDomTheme(name: ThemeName) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', name);
  document.documentElement.style.background = name === 'dark' ? dark.bg : light.bg;
  document.body.style.background = name === 'dark' ? dark.bg : light.bg;
  document.body.style.color = name === 'dark' ? dark.text : light.text;
  document.body.style.fontFamily = '"Inter", -apple-system, sans-serif';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<ThemeName>('light');

  useEffect(() => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('travo-theme');
      if (stored === 'dark' || stored === 'light') setName(stored);
    }
  }, []);

  useEffect(() => {
    applyDomTheme(name);
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem('travo-theme', name);
    }
  }, [name]);

  const value = useMemo(
    () => ({
      name,
      colors: name === 'dark' ? dark : light,
      toggle: () => setName((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [name]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppStyles() {
  const { colors } = useTheme();
  return useMemo(() => createAppStyles(colors), [colors]);
}

export function useTheme() {
  return useContext(ThemeContext);
}
