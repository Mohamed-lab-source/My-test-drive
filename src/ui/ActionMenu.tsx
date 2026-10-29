import React, { useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';

export interface MenuAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: string;
  // Starts a new group (a thicker gap above it), as iOS menus do.
  section?: boolean;
}

type ActionMenuProps = {
  visible: boolean;
  title?: string;
  actions: MenuAction[];
  onClose: () => void;
  anchor?: 'center' | ViewStyle;
};

// An iOS context menu: a rounded list over a blurred backdrop that springs
// open from where it's anchored, with a symbol beside each item. Every
// list row has one, so it costs nothing until it's opened.
export function ActionMenu(props: ActionMenuProps) {
  return props.visible ? <OpenActionMenu {...props} /> : null;
}

function OpenActionMenu({
  visible,
  title,
  actions,
  onClose,
  anchor = 'center',
}: ActionMenuProps) {
  const { colors, typography, scheme } = useTheme();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      progress.value = 0;
      progress.value = withSpring(1, { damping: 18, stiffness: 260, mass: 0.7 });
    }
  }, [visible]);
  const menu = useAnimatedStyle(() => ({
    opacity: withTiming(progress.value > 0.05 ? 1 : 0, { duration: 120 }),
    transform: [{ scale: 0.6 + 0.4 * progress.value }],
  }));
  const dark = scheme === 'dark';
  const origin = anchor === 'center' ? 'center' : 'bottom right';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={StyleSheet.absoluteFill}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={25} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.25)' }]} />
        )}
      </Pressable>
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, anchor === 'center' ? { alignItems: 'center', justifyContent: 'center' } : null]}>
        <Animated.View
          style={[
            {
              width: 270,
              borderRadius: 16,
              borderCurve: 'continuous',
              overflow: 'hidden',
              backgroundColor: dark ? 'rgba(44,44,46,0.98)' : 'rgba(250,250,252,0.98)',
              boxShadow: '0px 12px 40px rgba(0,0,0,0.25)',
              transformOrigin: origin,
            },
            anchor === 'center' ? null : [{ position: 'absolute' }, anchor],
            menu,
          ]}
        >
          {title ? (
            <Text
              style={[typography.footnote, { color: colors.secondaryLabel, textAlign: 'center', paddingVertical: 10, paddingHorizontal: 14 }]}
              numberOfLines={2}
            >
              {title}
            </Text>
          ) : null}
          {actions.map((a, i) => (
            <View key={a.label}>
              {i > 0 || title ? (
                <View style={{ height: a.section ? 7 : StyleSheet.hairlineWidth, backgroundColor: a.section ? colors.quaternaryFill : colors.separator }} />
              ) : null}
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  onClose();
                  a.onPress();
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 13,
                  paddingHorizontal: 16,
                  backgroundColor: pressed ? colors.tertiaryFill : 'transparent',
                })}
              >
                <Text style={[typography.body, { flex: 1, color: a.destructive ? colors.red : colors.label }]} numberOfLines={1}>
                  {a.label}
                </Text>
                {a.icon ? <Icon name={a.icon} size={19} color={a.destructive ? colors.red : colors.label} /> : null}
              </Pressable>
            </View>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
}
