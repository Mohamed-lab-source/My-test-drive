import React from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from '../../utils/haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../../ui/Icon';
import { ActionMenu, type MenuAction } from '../../ui/ActionMenu';
import { useQuickAddStore } from '../../store/quickAddStore';
import { useWaterStore } from '../../store/waterStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useUndoStore } from '../../store/undoStore';
import { TAB_BAR_HEIGHT } from '../../ui/GlassTabBar';

// The round + beside the tab bar (where iOS 26 puts its detached button).
// Tap: the current screen's own add action, or the add menu when the screen
// has none. Long-press: always the add menu.
export function QuickAddButton() {
  const { colors, scheme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { screenAction, menuOpen, setMenuOpen, open } = useQuickAddStore();
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }] }));
  const dark = scheme === 'dark';

  const showMenu = () => {
    rotate.value = withSequence(withTiming(45, { duration: 160 }), withTiming(0, { duration: 220 }));
    setMenuOpen(true);
  };

  const logWater = async () => {
    const before = useWaterStore.getState().count;
    const next = await useWaterStore.getState().add(1);
    const goal = useSettingsStore.getState().waterGoal;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    useUndoStore.getState().show(`Water: ${next} of ${goal} glasses`, async () => {
      await useWaterStore.getState().add(before - useWaterStore.getState().count);
    });
  };

  const actions: MenuAction[] = [
    { label: 'Expense', icon: 'arrow.up.circle.fill', onPress: () => open('expense') },
    { label: 'Income', icon: 'arrow.down.circle.fill', onPress: () => open('income') },
    { label: 'Transfer', icon: 'arrow.left.arrow.right', onPress: () => open('transfer') },
    { label: 'Task', icon: 'checkmark.circle.fill', onPress: () => open('task'), section: true },
    { label: 'Note', icon: 'doc.text.fill', onPress: () => router.push({ pathname: '/life/notes', params: { action: 'new' } }) },
    { label: 'Journal entry', icon: 'text.book.closed.fill', onPress: () => router.push('/life/journal') },
    { label: 'A glass of water', icon: 'drop.fill', onPress: logWater, section: true },
    { label: 'Search everything', icon: 'magnifyingglass', onPress: () => router.push('/search') },
  ];

  return (
    <>
      <Animated.View style={[styles.wrap, style]}>
        <Pressable
          onPressIn={() => {
            scale.value = withSpring(0.88, { damping: 15, stiffness: 320 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 12, stiffness: 300 });
          }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (screenAction) screenAction.onPress();
            else showMenu();
          }}
          onLongPress={showMenu}
          delayLongPress={300}
          accessibilityLabel={screenAction ? 'Add' : 'Add menu'}
          style={[styles.button, { backgroundColor: colors.blue, boxShadow: dark ? '0px 8px 24px rgba(0,0,0,0.5)' : `0px 8px 22px ${colors.blue}55` }]}
        >
          {Platform.OS === 'ios' ? <BlurView intensity={20} tint="light" style={[StyleSheet.absoluteFill, { opacity: 0.15 }]} /> : null}
          <Icon name={screenAction?.icon ?? 'plus'} size={30} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
      <ActionMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={actions}
        anchor={{ right: 16, bottom: Math.max(insets.bottom, 12) + TAB_BAR_HEIGHT + 16 }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { width: TAB_BAR_HEIGHT, height: TAB_BAR_HEIGHT, marginLeft: 10 },
  button: {
    width: TAB_BAR_HEIGHT,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // A thin light rim, for a glassy edge.
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
});
