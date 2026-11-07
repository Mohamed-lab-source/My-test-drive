import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import type { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../theme/ThemeProvider';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

export const TAB_BAR_HEIGHT = 64;
// Space to leave at the bottom of a screen so nothing hides under the bar.
export const tabBarClearance = (bottomInset: number) => TAB_BAR_HEIGHT + Math.max(bottomInset, 12) + 16;

function TabButton({ focused, label, icon, color, badge, onPress, onLongPress }: { focused: boolean; label: string; icon: React.ReactNode; color: string; badge?: string | number; onPress: () => void; onLongPress: () => void }) {
  const { typography, colors } = useTheme();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) scale.value = withSequence(withTiming(0.86, { duration: 90 }), withSpring(1, { damping: 10, stiffness: 280 }));
  }, [focused]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: focused }}>
      <Animated.View style={[{ alignItems: 'center' }, style]}>
        <View>
          {icon}
          {badge ? (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -10,
                minWidth: 17,
                height: 17,
                borderRadius: 9,
                paddingHorizontal: 4,
                backgroundColor: colors.red,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '700' }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[typography.caption2, { color, fontSize: 10.5, fontWeight: focused ? '700' : '500', marginTop: 2 }]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// The iOS 26 tab bar: a floating capsule of frosted glass with a lens that
// slides to the selected tab.
export function GlassTabBar({ state, descriptors, navigation, accessory }: TabBarProps & { accessory?: React.ReactNode }) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const routes = state.routes.filter((r) => (descriptors[r.key].options as { href?: unknown }).href !== null);
  const index = Math.max(0, routes.findIndex((r) => r.key === state.routes[state.index].key));
  const slot = width > 0 ? (width - 8) / routes.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    if (slot) x.value = withSpring(4 + index * slot, { damping: 20, stiffness: 230, mass: 0.8 });
  }, [index, slot]);
  const lens = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const dark = scheme === 'dark';

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={[
          styles.bar,
          { flex: 1 },
          {
            borderColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.9)',
            boxShadow: dark ? '0px 10px 30px rgba(0,0,0,0.5)' : '0px 10px 30px rgba(0,0,0,0.12), 0px 2px 6px rgba(0,0,0,0.06)',
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(34,34,36,0.97)' : 'rgba(252,252,254,0.97)' }]} />
        )}
        {slot ? (
          <Animated.View
            style={[
              styles.lens,
              { width: slot, backgroundColor: dark ? 'rgba(255,255,255,0.13)' : colors.blue + '18' },
              lens,
            ]}
          />
        ) : null}
        {routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const focused = i === index;
          const color = focused ? colors.blue : colors.secondaryLabel;
          const label = typeof options.title === 'string' ? options.title : route.name;
          return (
            <TabButton
              key={route.key}
              focused={focused}
              label={label}
              color={color}
              icon={options.tabBarIcon?.({ focused, color, size: 24 })}
              badge={options.tabBarBadge ?? undefined}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  Haptics.selectionAsync();
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center' },
  bar: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  lens: { position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: (TAB_BAR_HEIGHT - 8) / 2, borderCurve: 'continuous' },
  tab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
});
