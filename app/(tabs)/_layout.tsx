import React, { useEffect } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { settingsHydrated, useSettingsStore } from '../../src/store/settingsStore';
import { Icon } from '../../src/ui/Icon';
import { GlassTabBar } from '../../src/ui/GlassTabBar';
import { QuickAddButton } from '../../src/features/quickadd/QuickAddButton';
import { GlobalSheets } from '../../src/features/quickadd/GlobalSheets';

// Opening on a tab other than Home happens once per app launch.
let startTabApplied = false;

export default function TabsLayout() {
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
    <>
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} accessory={<QuickAddButton />} />}
      // A quick cross-fade between tabs.
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Icon name="house.fill" color={color as string} size={size - 1} />,
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: 'Money',
          tabBarIcon: ({ color, size }) => <Icon name="banknote.fill" color={color as string} size={size - 1} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <Icon name="checkmark.circle.fill" color={color as string} size={size - 1} />,
        }}
      />
      <Tabs.Screen
        name="life"
        options={{
          title: 'Life',
          tabBarIcon: ({ color, size }) => <Icon name="sparkles" color={color as string} size={size - 1} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Icon name="gearshape.fill" color={color as string} size={size - 1} />,
        }}
      />
    </Tabs>
    <GlobalSheets />
    </>
  );
}
