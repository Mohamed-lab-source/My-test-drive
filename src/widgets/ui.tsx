"use no memo";
// Small building blocks shared by the home-screen widgets: tinted colours,
// progress bars, rings and action pills.
import * as React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';

// "#007AFF" at 15% → "rgba(0, 122, 255, 0.15)".
export function tint(hex: string, alpha: number): ColorProp {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})` as ColorProp;
}

// A horizontal bar filled to `progress` (0–1), as two flex-weighted halves.
export function Bar({ progress, color, track, height = 6 }: { progress: number; color: ColorProp; track: ColorProp; height?: number }) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', height, borderRadius: height / 2, backgroundColor: track }}>
      {p > 0 ? <FlexWidget style={{ flex: Math.max(0.001, p), height, borderRadius: height / 2, backgroundColor: color }} /> : null}
      {p < 1 ? <FlexWidget style={{ flex: Math.max(0.001, 1 - p), height }} /> : null}
    </FlexWidget>
  );
}

// An Apple Watch-style ring as SVG.
export function ringSvg(progress: number, color: string, track: string, size = 84, stroke = 10): string {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
${p > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(circ * p).toFixed(2)} ${circ.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ''}
</svg>`;
}

export function Ring({ progress, color, track, size = 84, stroke = 10 }: { progress: number; color: string; track: string; size?: number; stroke?: number }) {
  return <SvgWidget svg={ringSvg(progress, color, track, size, stroke)} style={{ width: size, height: size }} />;
}

// A rounded, filled button that runs a click action.
export function Pill({
  label,
  color,
  clickAction,
  data,
  small = false,
}: {
  label: string;
  color: ColorProp;
  clickAction: string;
  data?: Record<string, unknown>;
  small?: boolean;
}) {
  return (
    <FlexWidget
      clickAction={clickAction}
      clickActionData={data}
      accessibilityLabel={label}
      style={{
        paddingHorizontal: small ? 10 : 12,
        paddingVertical: small ? 4 : 6,
        borderRadius: 14,
        backgroundColor: color,
        marginLeft: 8,
      }}
    >
      <TextWidget text={label} maxLines={1} style={{ fontSize: small ? 11 : 12, fontWeight: '700', color: '#FFFFFF' }} />
    </FlexWidget>
  );
}

// A tinted circle with an emoji in it, like a Settings icon.
export function Badge({ emoji, color, size = 36 }: { emoji: string; color: string; size?: number }) {
  return (
    <FlexWidget
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tint(color, 0.16),
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <TextWidget text={emoji} style={{ fontSize: Math.round(size * 0.48) }} />
    </FlexWidget>
  );
}
