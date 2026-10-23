// Mixes a #RRGGBB colour toward black (negative) or white (positive).
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// The two stops for a hero card in the user's accent colour.
export const heroGradient = (accent: string): [string, string] => [shade(accent, 0.08), shade(accent, -0.45)];
