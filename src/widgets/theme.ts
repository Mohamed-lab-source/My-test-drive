// The app's theme colors are typed as plain `string`, but the widget
// library's style props require its own `ColorProp` template-literal type
// (they're the same hex strings at runtime). Cast once here instead of at
// every call site in the widget components.
import type { ColorProp } from 'react-native-android-widget';
import { palette } from '../theme/colors';

export function widgetColors(scheme: 'light' | 'dark') {
  return palette[scheme] as unknown as Record<keyof typeof palette.light, ColorProp>;
}
