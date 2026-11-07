import React, { useEffect, useState } from 'react';
import { Text, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../theme/ThemeProvider';
import { useUndoStore } from '../store/undoStore';
import { Icon } from './Icon';

const PILL = 126;
const SPRING = { damping: 17, stiffness: 210, mass: 0.8 };

// Confirmations grow out of a Dynamic Island-style pill at the top of the
// screen and shrink back into it.
export function UndoSnackbar() {
  const { typography, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { message, onUndo, hide } = useUndoStore();
  const [shown, setShown] = useState<string | null>(null);
  const grow = useSharedValue(0);
  const full = Math.min(width - 24, 420);

  useEffect(() => {
    if (message) {
      setShown(message);
      grow.value = withSpring(1, SPRING);
    } else if (shown) {
      grow.value = withTiming(0, { duration: 260 }, (done) => {
        if (done) runOnJS(setShown)(null);
      });
    }
  }, [message]);

  const pill = useAnimatedStyle(() => ({
    width: PILL + (full - PILL) * grow.value,
    height: 37 + 21 * grow.value,
    borderRadius: 19 + 10 * grow.value,
    opacity: Math.min(1, grow.value * 3),
    transform: [{ translateY: -6 * (1 - grow.value) }],
  }));
  const content = useAnimatedStyle(() => ({ opacity: Math.max(0, (grow.value - 0.55) / 0.45) }));

  if (!shown) return null;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: insets.top + 6,
          alignSelf: 'center',
          backgroundColor: '#000000',
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden',
          boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.35)',
          zIndex: 100,
        },
        pill,
      ]}
    >
      <Animated.View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }, content]}>
        <Icon name="checkmark.circle.fill" size={22} color={colors.green} />
        <Text style={[typography.subhead, { color: '#FFFFFF', flex: 1, marginLeft: 10, fontWeight: '600' }]} numberOfLines={1}>
          {shown}
        </Text>
        {onUndo ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onUndo?.();
              hide();
            }}
            hitSlop={10}
            style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 }}
          >
            <Text style={[typography.subhead, { color: '#FFFFFF', fontWeight: '700' }]}>Undo</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}
