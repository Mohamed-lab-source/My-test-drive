import { Platform } from 'react-native';

// Apple's type scale. iOS uses San Francisco (the system font). Android uses
// Inter, the closest open-licence match, bundled as one family with real
// weights so fontWeight picks the right cut. Inter needs SF-like negative
// tracking at display sizes to look right.
const android = Platform.OS === 'android';
const fontFamily = Platform.select({
  ios: 'System',
  android: 'Inter',
  default: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
});
const track = (v: number) => (android ? v : 0);

export const typography = {
  // Hero figures: balances, totals and timers.
  display: { fontSize: 40, lineHeight: 46, fontWeight: '700' as const, fontFamily, letterSpacing: track(-1.2) },
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' as const, fontFamily, letterSpacing: track(-0.9) },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, fontFamily, letterSpacing: track(-0.7) },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, fontFamily, letterSpacing: track(-0.45) },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' as const, fontFamily, letterSpacing: track(-0.4) },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, fontFamily, letterSpacing: track(-0.3) },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' as const, fontFamily, letterSpacing: track(-0.3) },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' as const, fontFamily, letterSpacing: track(-0.25) },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const, fontFamily, letterSpacing: track(-0.2) },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, fontFamily, letterSpacing: track(-0.08) },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const, fontFamily, letterSpacing: 0 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400' as const, fontFamily, letterSpacing: track(0.06) },
};

export type TypographyVariant = keyof typeof typography;
