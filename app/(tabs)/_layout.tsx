import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { settingsHydrated, useSettingsStore } from '../../src/store/settingsStore';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Icon } from '../../src/ui/Icon';

// Opening on a tab other than Home happens once per app launch.
let startTabApplied = false;

export default function TabsLayout() {
  const { colors, scheme } = useTheme();
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
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.gray,
        tabBarStyle: {
          position: Platform.OS === 'ios' ? 'absolute' : undefined,
          borderTopColor: colors.separator,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.secondarySystemGroupedBackground,
        },
        tabBarBackground:
          Platform.OS === 'ios'
            ? () => (
                <BlurView
                  intensity={80}
                  tint={scheme === 'dark' ? 'dark' : 'light'}
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
          tabBarIcon: ({ color, size }) => <Icon name="house.fill" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: 'Money',
          tabBarIcon: ({ color, size }) => <Icon name="banknote.fill" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <Icon name="checkmark.circle.fill" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="life"
        options={{
          title: 'Life',
          tabBarIcon: ({ color, size }) => <Icon name="sparkles" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Icon name="gearshape.fill" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
