import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useLifeStore } from '../../../src/store/lifeStore';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import * as repo from '../../../src/db/repositories/life';
import { todayKey } from '../../../src/db/client';

const TARGETS = [33, 99, 100];
const PERSIST_DELAY_MS = 800;

export default function TasbihScreen() {
  const { colors, typography, spacing } = useTheme();
  const dhikrToday = useLifeStore((s) => s.dhikrToday);
  const [total, setTotal] = useState(dhikrToday);
  const [target, setTarget] = useState(33);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(total);
  const scale = useSharedValue(1);

  const ring = total % target;
  const rounds = Math.floor(total / target);

  // Taps update the screen immediately; the count is written (and synced)
  // once tapping pauses, instead of once per tap.
  const persist = (value: number) => {
    latest.current = value;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      useLifeStore.setState({ dhikrToday: value });
      repo.setDhikrCount(todayKey(), value);
    }, PERSIST_DELAY_MS);
  };

  useEffect(
    () => () => {
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        useLifeStore.setState({ dhikrToday: latest.current });
        repo.setDhikrCount(todayKey(), latest.current);
      }
    },
    []
  );

  const tap = () => {
    const next = total + 1;
    setTotal(next);
    persist(next);
    scale.value = withSequence(withTiming(0.94, { duration: 60 }), withTiming(1, { duration: 120 }));
    if (next % target === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const reset = () => {
    setTotal(0);
    persist(0);
  };

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Tasbih" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ marginBottom: spacing.xl }}>
          <ChipSelector
            options={TARGETS.map((t) => ({ id: String(t), label: `${t}` }))}
            selectedId={String(target)}
            onSelect={(id) => setTarget(Number(id))}
          />
        </View>
        <Animated.View style={buttonStyle}>
          <Pressable
            onPress={tap}
            style={{
              width: 240,
              height: 240,
              borderRadius: 120,
              backgroundColor: colors.secondarySystemGroupedBackground,
              borderWidth: 6,
              borderColor: colors.mint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 72, fontWeight: '300', color: colors.label, fontVariant: ['tabular-nums'] }}>{ring}</Text>
            <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>of {target}</Text>
          </Pressable>
        </Animated.View>
        <Text style={[typography.body, { color: colors.secondaryLabel, marginTop: spacing.xl }]}>
          {rounds} round{rounds === 1 ? '' : 's'} · {total} today
        </Text>
        <Pressable onPress={reset} hitSlop={10} style={{ marginTop: spacing.md }}>
          <Text style={[typography.subhead, { color: colors.red }]}>Reset today</Text>
        </Pressable>
      </View>
    </View>
  );
}
