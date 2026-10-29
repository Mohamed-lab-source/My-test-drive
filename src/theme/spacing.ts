import type { ViewStyle } from 'react-native';

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 22,
  xxl: 30,
  pill: 999,
};

// Soft, layered shadows in the style of iOS widgets. boxShadow renders the
// same on Android and iOS (no Material elevation look).
export const shadow: Record<'card' | 'floating' | 'none', ViewStyle> = {
  card: {
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.04), 0px 6px 20px rgba(0, 0, 0, 0.05)',
  },
  floating: {
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.10), 0px 16px 36px rgba(0, 0, 0, 0.16)',
  },
  none: {},
};
