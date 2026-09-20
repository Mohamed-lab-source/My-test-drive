import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';

interface SwipeAction {
  label: string;
  color: string;
  onPress: () => void;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  actions: SwipeAction[];
}

const ACTION_WIDTH = 76;

export function SwipeableRow({ children, actions }: SwipeableRowProps) {
  const translateX = useSharedValue(0);
  const maxSwipe = -ACTION_WIDTH * actions.length;
  const { typography } = useTheme();

  const close = () => {
    translateX.value = withTiming(0, { duration: 200 });
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      translateX.value = Math.max(maxSwipe, Math.min(0, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX < maxSwipe / 2) {
        translateX.value = withTiming(maxSwipe, { duration: 180 });
      } else {
        translateX.value = withTiming(0, { duration: 180 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <View style={styles.container}>
      <View style={[styles.actions, { width: ACTION_WIDTH * actions.length }]}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            style={[styles.actionButton, { backgroundColor: action.color, width: ACTION_WIDTH }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              close();
              action.onPress();
            }}
          >
            <Text style={[typography.footnote, { color: '#fff', fontWeight: '600' }]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  actions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  actionButton: { alignItems: 'center', justifyContent: 'center', height: '100%' },
});
