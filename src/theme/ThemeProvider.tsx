import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
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

const SOFT_DARK: Partial<ThemeColors> = {
  systemBackground: '#17181A',
  secondarySystemBackground: '#222326',
  systemGroupedBackground: '#17181A',
  secondarySystemGroupedBackground: '#222326',
  tertiarySystemGroupedBackground: '#2E2F33',
};

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
  const softDark = useSettingsStore((s) => s.softDark);

  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const theme = useMemo<Theme>(
    () => ({
      scheme,
      // The accent colour (Settings → Appearance) replaces the default blue
      // used for buttons, links and selection everywhere.
      colors: {
        ...palette[scheme],
        ...(accent === 'blue' ? null : { blue: palette[scheme][accent] }),
        // "Soft dark": charcoal instead of true black, easier on some eyes.
        ...(scheme === 'dark' && softDark ? SOFT_DARK : null),
      },
      typography: scaleTypography(textScale),
      spacing,
      radius,
      // Dark mode lifts cards with colour, not shadows (as iOS does).
      shadow: scheme === 'dark' ? { ...shadow, card: shadow.none } : shadow,
    }),
    [scheme, textScale, accent, softDark]
  );

  // The window behind every screen matches the theme, so transitions never
  // flash white in dark mode.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.systemGroupedBackground).catch(() => {});
  }, [theme.colors.systemGroupedBackground]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
