import { Platform } from 'react-native';

// Apple's iOS type scale (San Francisco), mapped to a font family available
// on-device: the system font on iOS/Android, and a close web fallback.
const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
});

export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' as const, fontFamily },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, fontFamily },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, fontFamily },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' as const, fontFamily },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, fontFamily },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' as const, fontFamily },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' as const, fontFamily },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const, fontFamily },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, fontFamily },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const, fontFamily },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400' as const, fontFamily },
};

export type TypographyVariant = keyof typeof typography;
