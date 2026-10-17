import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { palette, type ColorScheme, type ThemeColors } from './colors';
import { typography } from './typography';
import { spacing, radius, shadow } from './spacing';
import { useSettingsStore } from '../store/settingsStore';

interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  shadow: typeof shadow;
}

const ThemeContext = createContext<Theme | null>(null);

// The "Larger text" setting scales every text style from one place.
function scaleTypography(scale: number): typeof typography {
  if (scale === 1) return typography;
  return Object.fromEntries(
    Object.entries(typography).map(([k, v]) => [k, { ...v, fontSize: Math.round(v.fontSize * scale), lineHeight: Math.round(v.lineHeight * scale) }])
  ) as typeof typography;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = useSettingsStore((s) => s.appearance);
  const textScale = useSettingsStore((s) => s.textScale);
  const accent = useSettingsStore((s) => s.accent);

  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const theme = useMemo<Theme>(
    () => ({
      scheme,
      // The accent colour (Settings → Appearance) replaces the default blue
      // used for buttons, links and selection everywhere.
      colors: accent === 'blue' ? palette[scheme] : { ...palette[scheme], blue: palette[scheme][accent] },
      typography: scaleTypography(textScale),
      spacing,
      radius,
      shadow,
    }),
    [scheme, textScale, accent]
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
