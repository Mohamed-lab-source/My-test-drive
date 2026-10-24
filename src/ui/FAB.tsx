import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { ZoomIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../theme/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarClearance } from './GlassTabBar';
import { Icon } from './Icon';

interface FABProps {
  onPress: () => void;
  icon?: string;
}

export function FAB({ onPress, icon = 'plus' }: FABProps) {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={ZoomIn.delay(150).springify().damping(14)} style={[styles.wrapper, { bottom: tabBarClearance(insets.bottom) - 4 }]}>
    <Animated.View style={[animatedStyle, shadow.floating, { borderRadius: 29 }]}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 300 });
        }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        style={[styles.button, { backgroundColor: colors.blue }]}
      >
        <Icon name={icon} size={30} color="#fff" />
      </Pressable>
    </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', right: 20, bottom: 24 },
  button: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
