export type ThemeColors = {
  background: string;
  surface: string;
  primary: string;
  primaryDark: string;
  secondary: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  danger: string;
  chipBackground: string;
};

export const lightColors: ThemeColors = {
  background: "#FFFBF6",
  surface: "#FFFFFF",
  primary: "#E8632C",
  primaryDark: "#C74E1D",
  secondary: "#2F5D50",
  text: "#231A16",
  textMuted: "#8A7B72",
  border: "#F0E4DA",
  success: "#2F7A4B",
  danger: "#C0392B",
  chipBackground: "#FCEEE3",
};

export const darkColors: ThemeColors = {
  background: "#15110E",
  surface: "#221C18",
  primary: "#F2814A",
  primaryDark: "#FFA36E",
  secondary: "#5B9C89",
  text: "#F5ECE5",
  textMuted: "#AB9C92",
  border: "#372E27",
  success: "#57B478",
  danger: "#E37364",
  chipBackground: "#2C241E",
};

export const spacing = (n: number) => n * 8;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
};

/** Soft elevation presets shared across cards and floating surfaces. */
export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  floating: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 6,
  },
} as const;
