"use no memo";
// Liquid Glass for home-screen widgets. Android can't blur the wallpaper
// behind a widget, so this is the closest it gets: a see-through body with
// a light sheen and a bright rim, frosted inner panels, and white text with
// a soft shadow so it reads on any wallpaper. It restyles a finished
// widget, so every widget gets the same treatment from one place.
import * as React from 'react';
import { OverlapWidget, SvgWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';
import { widgetColors } from './theme';

export type WidgetLook = 'glass' | 'solid';

type El = React.ReactElement<{ style?: Record<string, unknown>; children?: React.ReactNode }>;

// The glass surface itself, drawn as an image because a widget's own
// background can't combine a gradient with a border: a smoky translucent
// body, a curved specular sheen across the top, a rim that catches the
// light at the top and bottom edges, and a faint inner rim for thickness.
// `tint` is the wallpaper's main colours: frosted glass mostly looks like the
// average colour of what's behind it, so the glass takes on that tint, and
// on a light wallpaper it gets smokier so white text still reads.
export function glassSvg(w: number, h: number, scheme: 'light' | 'dark', tint: string[] = [], radius = 28): string {
  const dark = scheme === 'dark';
  const r = Math.min(radius, h / 2, w / 2);
  const top = dark ? 0.2 : 0.3;
  const bottom = dark ? 0.06 : 0.1;
  const light = tint.length ? luminance(tint[0]) : 0.4;
  const smoke = (dark ? 0.26 : 0.1) + Math.max(0, light - 0.45) * 0.45;
  const [t1, t2] = [tint[0], tint[1] ?? tint[0]];
  // Drawn at 3× and scaled down to the widget, so the rim stays crisp.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 3}" height="${h * 3}" viewBox="0 0 ${w} ${h}">
<defs>
<linearGradient id="body" x1="0" y1="0" x2="0.35" y2="1">
<stop offset="0" stop-color="#FFFFFF" stop-opacity="${top}"/>
<stop offset="1" stop-color="#FFFFFF" stop-opacity="${bottom}"/>
</linearGradient>
<radialGradient id="sheen" cx="0.3" cy="0" r="0.75" fx="0.3" fy="0">
<stop offset="0" stop-color="#FFFFFF" stop-opacity="${dark ? 0.32 : 0.5}"/>
<stop offset="0.55" stop-color="#FFFFFF" stop-opacity="${dark ? 0.06 : 0.1}"/>
<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
</radialGradient>
<linearGradient id="tint" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${t1 ?? '#FFFFFF'}" stop-opacity="${t1 ? 0.34 : 0}"/>
<stop offset="1" stop-color="${t2 ?? '#FFFFFF'}" stop-opacity="${t2 ? 0.26 : 0}"/>
</linearGradient>
<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#FFFFFF" stop-opacity="${dark ? 0.7 : 0.95}"/>
<stop offset="0.45" stop-color="#FFFFFF" stop-opacity="${dark ? 0.12 : 0.25}"/>
<stop offset="1" stop-color="#FFFFFF" stop-opacity="${dark ? 0.4 : 0.6}"/>
</linearGradient>
</defs>
<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${r}" ry="${r}" fill="#000000" fill-opacity="${smoke.toFixed(2)}"/>
<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${r}" ry="${r}" fill="url(#tint)"/>
<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${r}" ry="${r}" fill="url(#body)"/>
<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${r}" ry="${r}" fill="url(#sheen)"/>
<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${r}" ry="${r}" fill="none" stroke="url(#rim)" stroke-width="1.5"/>
<rect x="2.5" y="2.5" width="${w - 5}" height="${h - 5}" rx="${Math.max(0, r - 2)}" ry="${Math.max(0, r - 2)}" fill="none" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="1"/>
</svg>`;
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const ch = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

export function applyGlass(tree: El, scheme: 'light' | 'dark', size?: { width: number; height: number }, tint: string[] = []): El {
  const c = widgetColors(scheme);
  const panel = 'rgba(255, 255, 255, 0.18)' as ColorProp;
  const text: Record<string, ColorProp> = {
    [c.label]: '#FFFFFF' as ColorProp,
    [c.secondaryLabel]: 'rgba(255, 255, 255, 0.82)' as ColorProp,
    [c.tertiaryLabel]: 'rgba(255, 255, 255, 0.6)' as ColorProp,
  };
  // Accent colours lifted for dark glass, as iOS does, so red, green and
  // blue status words stay readable on their capsule.
  const bright: Record<string, ColorProp> = {
    [c.red]: '#FF8A80' as ColorProp,
    [c.green]: '#6BF29A' as ColorProp,
    [c.blue]: '#8CC4FF' as ColorProp,
    [c.orange]: '#FFC266' as ColorProp,
    [c.teal]: '#8FE6FF' as ColorProp,
    [c.purple]: '#E0A8FF' as ColorProp,
    [c.indigo]: '#A9A8FF' as ColorProp,
  };
  const panels = new Set<string>([c.tertiaryFill, c.fill, c.secondaryFill, c.quaternaryFill]);

  let foundBody = false;
  const visit = (node: React.ReactNode): React.ReactNode => {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== 'object' || !('type' in node)) return node;
    let el = node as El;
    // Expand helper components (Pill, Bar, Badge…) the way the widget
    // library does, so their parts get restyled too.
    while (typeof el.type === 'function' && !(el.type as unknown as { __name__?: string }).__name__) {
      el = (el.type as (p: unknown) => El)(el.props);
      if (!el) return el;
    }
    const name = (el.type as unknown as { __name__?: string }).__name__;
    const style: Record<string, unknown> = { ...(el.props.style ?? {}) };
    if (name === 'TextWidget') {
      const color = style.color as string | undefined;
      const plain = !color || !!text[color] || color === '#FFFFFF';
      if (color && text[color]) style.color = text[color];
      style.textShadowColor = 'rgba(0, 0, 0, 0.35)';
      style.textShadowRadius = 3;
      style.textShadowOffset = { width: 0, height: 1 };
      // Coloured words (Overdue, Watch it, ▲ this month) keep their colour
      // on a small dark-glass capsule, so they read on any wallpaper.
      const words = String((el.props as { text?: unknown }).text ?? '');
      if (!plain && words.length > 2 && !style.backgroundColor) {
        style.color = bright[color as string] ?? color;
        style.backgroundColor = 'rgba(0, 0, 0, 0.32)';
        style.paddingHorizontal = 6;
        style.paddingVertical = 1;
        style.borderRadius = 8;
        style.textShadowColor = 'rgba(0, 0, 0, 0)';
      }
    } else if (name === 'FlexWidget' || name === 'OverlapWidget') {
      const bg = style.backgroundColor as string | undefined;
      if (bg === c.secondarySystemGroupedBackground) {
        // The widget's own body: see-through, with the glass drawn
        // underneath it (see glassSvg).
        delete style.backgroundColor;
        foundBody = true;
      } else if (bg && panels.has(bg)) {
        // Inner panels: frosted, with a thin glass edge.
        style.backgroundColor = panel;
        style.borderWidth = 0.75;
        style.borderColor = 'rgba(255, 255, 255, 0.28)' as ColorProp;
      }
      if (style.borderColor === c.gray3) style.borderColor = 'rgba(255, 255, 255, 0.75)' as ColorProp;
    }
    const children = el.props.children;
    return children === undefined
      ? React.cloneElement(el, { style })
      : React.cloneElement(el, { style }, visit(children) as React.ReactNode);
  };
  const content = visit(tree) as El;
  if (!foundBody || !size) return content;
  // Glass underneath, the widget's content on top.
  return React.createElement(
    OverlapWidget,
    { style: { width: 'match_parent', height: 'match_parent' } },
    React.createElement(SvgWidget, { svg: glassSvg(Math.round(size.width), Math.round(size.height), scheme, tint), style: { width: Math.round(size.width), height: Math.round(size.height) } }),
    content
  ) as El;
}
