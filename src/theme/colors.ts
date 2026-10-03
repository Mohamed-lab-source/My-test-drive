// iOS system color palette (light & dark), matching Apple HIG values.
export interface ThemeColors {
  label: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  quaternaryLabel: string;
  placeholderText: string;
  systemBackground: string;
  secondarySystemBackground: string;
  tertiarySystemBackground: string;
  systemGroupedBackground: string;
  secondarySystemGroupedBackground: string;
  tertiarySystemGroupedBackground: string;
  separator: string;
  opaqueSeparator: string;
  fill: string;
  secondaryFill: string;
  tertiaryFill: string;
  quaternaryFill: string;
  blue: string;
  green: string;
  indigo: string;
  orange: string;
  pink: string;
  purple: string;
  red: string;
  teal: string;
  yellow: string;
  mint: string;
  cyan: string;
  brown: string;
  gray: string;
  gray2: string;
  gray3: string;
  gray4: string;
  gray5: string;
  gray6: string;
}

export const palette: Record<'light' | 'dark', ThemeColors> = {
  light: {
    label: '#000000',
    secondaryLabel: '#3C3C43',
    tertiaryLabel: '#3C3C43',
    quaternaryLabel: '#3C3C43',
    placeholderText: '#3C3C4399',
    systemBackground: '#FFFFFF',
    secondarySystemBackground: '#F2F2F7',
    tertiarySystemBackground: '#FFFFFF',
    systemGroupedBackground: '#F2F2F7',
    secondarySystemGroupedBackground: '#FFFFFF',
    tertiarySystemGroupedBackground: '#F2F2F7',
    separator: '#3C3C4349',
    opaqueSeparator: '#C6C6C8',
    fill: '#78788033',
    secondaryFill: '#78788028',
    tertiaryFill: '#7676801E',
    quaternaryFill: '#74748014',

    blue: '#007AFF',
    green: '#34C759',
    indigo: '#5856D6',
    orange: '#FF9500',
    pink: '#FF2D55',
    purple: '#AF52DE',
    red: '#FF3B30',
    teal: '#5AC8FA',
    yellow: '#FFCC00',
    mint: '#00C7BE',
    cyan: '#32ADE6',
    brown: '#A2845E',
    gray: '#8E8E93',
    gray2: '#AEAEB2',
    gray3: '#C7C7CC',
    gray4: '#D1D1D6',
    gray5: '#E5E5EA',
    gray6: '#F2F2F7',
  },
  dark: {
    label: '#FFFFFF',
    secondaryLabel: '#EBEBF5',
    tertiaryLabel: '#EBEBF5',
    quaternaryLabel: '#EBEBF5',
    placeholderText: '#EBEBF599',
    systemBackground: '#000000',
    secondarySystemBackground: '#1C1C1E',
    tertiarySystemBackground: '#2C2C2E',
    systemGroupedBackground: '#000000',
    secondarySystemGroupedBackground: '#1C1C1E',
    tertiarySystemGroupedBackground: '#2C2C2E',
    separator: '#54545899',
    opaqueSeparator: '#38383A',
    fill: '#7878805B',
    secondaryFill: '#78788051',
    tertiaryFill: '#7676803D',
    quaternaryFill: '#7676802E',

    blue: '#0A84FF',
    green: '#30D158',
    indigo: '#5E5CE6',
    orange: '#FF9F0A',
    pink: '#FF375F',
    purple: '#BF5AF2',
    red: '#FF453A',
    teal: '#64D2FF',
    yellow: '#FFD60A',
    mint: '#66D4CF',
    cyan: '#64D2FF',
    brown: '#AC8E68',
    gray: '#8E8E93',
    gray2: '#636366',
    gray3: '#48484A',
    gray4: '#3A3A3C',
    gray5: '#2C2C2E',
    gray6: '#1C1C1E',
  },
} as const;

export type ColorScheme = 'light' | 'dark';

// Category & accent colors used across finance/tasks/life modules.
export const accentColors = [
  '#007AFF',
  '#34C759',
  '#FF9500',
  '#FF3B30',
  '#AF52DE',
  '#FF2D55',
  '#5AC8FA',
  '#FFCC00',
  '#00C7BE',
  '#5856D6',
  '#A2845E',
  '#8E8E93',
] as const;
