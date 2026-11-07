import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

// How far the page scrolls before the small title takes over: roughly the
// height of the large title.
export const COLLAPSE_AT = 52;

export function useScrollY() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  return { scrollY, onScroll };
}

// The thin bar with a centred title that fades in once the large title has
// scrolled away, as in iOS Settings, Wallet and Health.
export function CompactHeader({ title, scrollY }: { title: string; scrollY: SharedValue<number> }) {
  const { colors, typography, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const bar = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_AT - 16, COLLAPSE_AT + 4], [0, 1], Extrapolation.CLAMP),
  }));
  const label = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_AT, COLLAPSE_AT + 14], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [COLLAPSE_AT, COLLAPSE_AT + 14], [6, 0], Extrapolation.CLAMP) }],
  }));
  return (
    <View pointerEvents="none" style={[styles.wrap, { height: insets.top + 44 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, bar]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={90} tint={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.systemGroupedBackground + 'F7' }]} />
        )}
        <View style={[styles.hairline, { backgroundColor: colors.separator }]} />
      </Animated.View>
      <Animated.View style={[styles.titleRow, { top: insets.top }, label]}>
        <Text style={[typography.headline, { color: colors.label }]} numberOfLines={1}>
          {title}
        </Text>
      </Animated.View>
    </View>
  );
}

// Large titles grow a little when you pull the page down.
export function useLargeTitleZoom(scrollY?: SharedValue<number>) {
  return useAnimatedStyle(() => {
    if (!scrollY) return {};
    return {
      transform: [{ scale: interpolate(scrollY.value, [-140, 0], [1.1, 1], Extrapolation.CLAMP) }],
    };
  });
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  titleRow: { position: 'absolute', left: 60, right: 60, height: 44, alignItems: 'center', justifyContent: 'center' },
});
