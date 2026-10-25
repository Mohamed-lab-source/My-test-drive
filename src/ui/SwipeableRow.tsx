import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming, Extrapolation } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';

interface SwipeAction {
  label: string;
  color: string;
  onPress: () => void;
  icon?: string;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  actions: SwipeAction[];
  // Swiping right past the threshold runs this straight away, as in Mail.
  leading?: SwipeAction;
}

const ACTION_WIDTH = 76;
const LEADING_TRIGGER = 96;
const SPRING = { damping: 22, stiffness: 260, mass: 0.7 };

const ICONS: Record<string, string> = { Delete: 'trash.fill', Tomorrow: 'arrow.right', Edit: 'pencil', Pin: 'bookmark.fill', Share: 'square.and.arrow.up', Done: 'checkmark.circle.fill' };

export function SwipeableRow({ children, actions, leading }: SwipeableRowProps) {
  const translateX = useSharedValue(0);
  const armed = useSharedValue(false);
  const maxSwipe = -ACTION_WIDTH * actions.length;
  const { typography, colors } = useTheme();

  const close = () => {
    translateX.value = withSpring(0, SPRING);
  };
  const tick = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const runLeading = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    leading?.onPress();
  };

  // A haptic tick the moment a leading swipe passes the point of no return.
  useAnimatedReaction(
    () => translateX.value > LEADING_TRIGGER,
    (past, before) => {
      if (leading && past !== before && past) runOnJS(tick)();
      armed.value = past;
    }
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      const min = maxSwipe;
      const max = leading ? 160 : 0;
      // Rubber-band past the ends.
      const x = e.translationX;
      translateX.value = x < min ? min + (x - min) * 0.25 : x > max ? max + (x - max) * 0.2 : x;
    })
    .onEnd((e) => {
      if (leading && translateX.value > LEADING_TRIGGER) {
        translateX.value = withTiming(0, { duration: 220 });
        runOnJS(runLeading)();
      } else if (actions.length && (translateX.value < maxSwipe / 2 || e.velocityX < -800)) {
        translateX.value = withSpring(maxSwipe, SPRING);
      } else {
        translateX.value = withSpring(0, SPRING);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  // Actions stay hidden until the row moves, so their colour can't show
  // around a card's rounded corners.
  const actionsStyle = useAnimatedStyle(() => ({ opacity: translateX.value < -1 ? 1 : 0 }));
  const leadingStyle = useAnimatedStyle(() => ({ opacity: translateX.value > 1 ? 1 : 0 }));
  const leadingIcon = useAnimatedStyle(() => ({
    transform: [{ scale: armed.value ? withSpring(1.25, { damping: 10 }) : interpolate(translateX.value, [0, LEADING_TRIGGER], [0.6, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.container}>
      {leading ? (
        <Animated.View style={[styles.leading, { backgroundColor: leading.color }, leadingStyle]}>
          <Animated.View style={[{ alignItems: 'center' }, leadingIcon]}>
            <Icon name={leading.icon ?? ICONS[leading.label] ?? 'checkmark.circle.fill'} size={24} color="#fff" />
            <Text style={[typography.caption1, { color: '#fff', fontWeight: '700', marginTop: 2 }]}>{leading.label}</Text>
          </Animated.View>
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.actions, { width: ACTION_WIDTH * actions.length }, actionsStyle]}>
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
            {action.icon ?? ICONS[action.label] ? <Icon name={(action.icon ?? ICONS[action.label])!} size={20} color="#fff" /> : null}
            <Text style={[typography.caption1, { color: '#fff', fontWeight: '600', marginTop: 3 }]} numberOfLines={1}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.rowForeground, { backgroundColor: colors.secondarySystemGroupedBackground }, rowStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  // Explicit position + an opaque background ensure this paints above the
  // absolutely-positioned actions: on web, CSS always stacks positioned
  // elements above static siblings regardless of DOM order.
  rowForeground: { position: 'relative', zIndex: 1 },
  actions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  leading: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, justifyContent: 'center', paddingLeft: 22 },
  actionButton: { alignItems: 'center', justifyContent: 'center', height: '100%' },
});
