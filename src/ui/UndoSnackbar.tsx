import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { useUndoStore } from '../store/undoStore';

export function UndoSnackbar() {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { message, onUndo, hide } = useUndoStore();

  if (!message) return null;

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutDown}
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: insets.bottom + 90,
        backgroundColor: colors.label,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <Text style={[typography.subhead, { color: colors.systemGroupedBackground, flex: 1 }]} numberOfLines={1}>
        {message}
      </Text>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onUndo?.();
          hide();
        }}
        hitSlop={8}
      >
        <Text style={[typography.subhead, { color: colors.blue, fontWeight: '700', marginLeft: spacing.md }]}>Undo</Text>
      </Pressable>
    </Animated.View>
  );
}
