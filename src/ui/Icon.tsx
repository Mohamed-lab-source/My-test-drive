import React from 'react';
import { Ionicons } from '@expo/vector-icons';

// We use SF-Symbol-style names internally (matches Apple's naming so it reads
// naturally throughout the data layer) and map them to Ionicons glyphs, which
// render consistently across iOS, Android and web.
const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  'cart.fill': 'cart',
  'house.fill': 'home',
  'car.fill': 'car',
  'fork.knife': 'restaurant',
  'bolt.fill': 'flash',
  'heart.fill': 'heart',
  'repeat': 'repeat',
  'bag.fill': 'bag',
  'heart.circle.fill': 'heart-circle',
  'gift.fill': 'gift',
  'banknote.fill': 'cash',
  'laptopcomputer': 'laptop',
  'ellipsis.circle.fill': 'ellipsis-horizontal-circle',
  'dollarsign.circle.fill': 'cash',
  'building.columns.fill': 'business',
  'creditcard.fill': 'card',
  'wallet.pass.fill': 'wallet',
  'banknote': 'cash-outline',
  'star.fill': 'star',
  'star': 'star-outline',
  'checkmark.circle.fill': 'checkmark-circle',
  'checkmark.circle': 'checkmark-circle-outline',
  'circle': 'ellipse-outline',
  'plus': 'add',
  'plus.circle.fill': 'add-circle',
  'trash.fill': 'trash',
  'trash': 'trash-outline',
  'pencil': 'pencil',
  'chevron.right': 'chevron-forward',
  'chevron.left': 'chevron-back',
  'chevron.down': 'chevron-down',
  'gearshape.fill': 'settings',
  'moon.fill': 'moon',
  'sun.max.fill': 'sunny',
  'bell.fill': 'notifications',
  'calendar': 'calendar',
  'clock.fill': 'time',
  'list.bullet': 'list',
  'tray.fill': 'file-tray-full',
  'flag.fill': 'flag',
  'person.fill': 'person',
  'person.2.fill': 'people',
  'target': 'flag',
  'chart.pie.fill': 'pie-chart',
  'chart.bar.fill': 'bar-chart',
  'arrow.left.arrow.right': 'swap-horizontal',
  'arrow.up.circle.fill': 'arrow-up-circle',
  'arrow.down.circle.fill': 'arrow-down-circle',
  'lightbulb.fill': 'bulb',
  'sparkles': 'sparkles',
  'briefcase.fill': 'briefcase',
  'book.fill': 'book',
  'hands.sparkles.fill': 'hand-left',
  'moon.stars.fill': 'moon',
  'archivebox.fill': 'archive',
  'square.and.arrow.up': 'share',
  'square.and.arrow.down': 'download',
  'doc.text.fill': 'document-text',
  'exclamationmark.triangle.fill': 'warning',
  'xmark': 'close',
  'xmark.circle.fill': 'close-circle',
  'ellipsis': 'ellipsis-horizontal',
  'link': 'link',
  'location.fill': 'location',
  'building.2.fill': 'business',
  'graduationcap.fill': 'school',
  'airplane': 'airplane',
  'gamecontroller.fill': 'game-controller',
  'tshirt.fill': 'shirt',
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = '#000' }: IconProps) {
  const glyph = ICON_MAP[name] ?? 'ellipse';
  return <Ionicons name={glyph} size={size} color={color} />;
}
