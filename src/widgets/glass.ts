"use no memo";
// Liquid Glass for home-screen widgets. Android can't blur the wallpaper
// behind a widget, so this is the closest it gets: a see-through body with
// a light sheen and a bright rim, frosted inner panels, and white text with
// a soft shadow so it reads on any wallpaper. It restyles a finished
// widget, so every widget gets the same treatment from one place.
import * as React from 'react';
import type { ColorProp } from 'react-native-android-widget';
import { widgetColors } from './theme';

export type WidgetLook = 'glass' | 'solid';

type El = React.ReactElement<{ style?: Record<string, unknown>; children?: React.ReactNode }>;

export function applyGlass(tree: El, scheme: 'light' | 'dark'): El {
  const c = widgetColors(scheme);
  const dark = scheme === 'dark';
  const body = {
    // A sheen from the top-left corner, fading towards the bottom-right.
    from: (dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.34)') as ColorProp,
    to: (dark ? 'rgba(20, 20, 24, 0.22)' : 'rgba(255, 255, 255, 0.10)') as ColorProp,
  };
  const rim = (dark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.6)') as ColorProp;
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
        // The widget's own body: clear glass with a bright rim.
        delete style.backgroundColor;
        style.backgroundGradient = { ...body, orientation: 'TL_BR' };
        style.borderWidth = 1;
        style.borderColor = rim;
        style.borderRadius = 28;
      } else if (bg && panels.has(bg)) {
        style.backgroundColor = panel;
      }
      if (style.borderColor === c.gray3) style.borderColor = 'rgba(255, 255, 255, 0.75)' as ColorProp;
    }
    const children = el.props.children;
    return children === undefined
      ? React.cloneElement(el, { style })
      : React.cloneElement(el, { style }, visit(children) as React.ReactNode);
  };
  return visit(tree) as El;
}
