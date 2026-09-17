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
