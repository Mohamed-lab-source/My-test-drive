import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { settingsHydrated, useSettingsStore } from '../../src/store/settingsStore';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Icon } from '../../src/ui/Icon';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from '../../src/utils/haptics';

// The selected tab's symbol gives a small bounce, as SF Symbols do on iOS.
function TabIcon({ name, color, size, focused }: { name: string; color: string; size: number; focused: boolean }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) scale.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 9, stiffness: 260 }));
  }, [focused]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Icon name={name} color={color} size={size} />
    </Animated.View>
  );
}

// Opening on a tab other than Home happens once per app launch.
let startTabApplied = false;

export default function TabsLayout() {
  const { colors, scheme, typography } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (startTabApplied) return;
    startTabApplied = true;
    settingsHydrated().then(() => {
      const tab = useSettingsStore.getState().startTab;
      // Skip when a notification or link already opened somewhere else.
      if (tab !== 'home' && pathname === '/') router.navigate(`/${tab}`);
    });
  }, []);

  return (
    <Tabs
      screenListeners={{ tabPress: () => Haptics.selectionAsync() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.gray,
        tabBarLabelStyle: { fontFamily: typography.caption2.fontFamily, fontSize: 10.5, fontWeight: '600', letterSpacing: 0.1 },
        tabBarStyle: {
          position: Platform.OS === 'ios' ? 'absolute' : undefined,
          borderTopColor: colors.separator,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          // Android: the iOS bar's off-white (or near-black) chrome.
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : scheme === 'dark' ? '#121212' : '#F9F9F9',
        },
        tabBarBackground:
          Platform.OS === 'ios'
            ? () => (
                <BlurView
                  intensity={80}
                  tint={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
                  style={StyleSheet.absoluteFill}
                />
              )
            : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => <TabIcon focused={focused} name="house.fill" color={color as string} size={size - 1} />,
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: 'Money',
          tabBarIcon: ({ color, size, focused }) => <TabIcon focused={focused} name="banknote.fill" color={color as string} size={size - 1} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size, focused }) => <TabIcon focused={focused} name="checkmark.circle.fill" color={color as string} size={size - 1} />,
        }}
      />
      <Tabs.Screen
        name="life"
        options={{
          title: 'Life',
          tabBarIcon: ({ color, size, focused }) => <TabIcon focused={focused} name="sparkles" color={color as string} size={size - 1} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }) => <TabIcon focused={focused} name="gearshape.fill" color={color as string} size={size - 1} />,
        }}
      />
    </Tabs>
  );
}
