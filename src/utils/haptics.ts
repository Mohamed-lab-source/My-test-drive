import * as ExpoHaptics from 'expo-haptics';
import { useSettingsStore } from '../store/settingsStore';

// expo-haptics behind the Settings switch, so turning vibration off
// silences every tap, tick and success buzz in the app.
export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

const on = () => useSettingsStore.getState().hapticsEnabled;

export const impactAsync = (style?: ExpoHaptics.ImpactFeedbackStyle) => (on() ? ExpoHaptics.impactAsync(style) : Promise.resolve());
export const notificationAsync = (type?: ExpoHaptics.NotificationFeedbackType) =>
  on() ? ExpoHaptics.notificationAsync(type) : Promise.resolve();
export const selectionAsync = () => (on() ? ExpoHaptics.selectionAsync() : Promise.resolve());
