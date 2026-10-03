import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { ProgressBar } from '../../ui/ProgressBar';
import { useSettingsStore } from '../../store/settingsStore';
import { useWaterStore } from '../../store/waterStore';

export function WaterCard() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const goal = useSettingsStore((s) => s.waterGoal);
  const count = useWaterStore((s) => s.count);
  const { load, add } = useWaterStore.getState();

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const addGlass = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = await add(1);
    if (next === goal) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => router.push('/life/health')} style={{ flex: 1 }}>
          <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>💧 Water today</Text>
          <Text style={[typography.title3, { color: count >= goal ? colors.green : colors.label }]}>
            {count} / {goal} glasses
          </Text>
        </Pressable>
        <Pressable onPress={addGlass} hitSlop={10}>
          <Icon name="plus.circle.fill" size={34} color={colors.blue} />
        </Pressable>
      </View>
      <View style={{ marginTop: spacing.sm }}>
        <ProgressBar progress={Math.min(1, count / goal)} color={colors.blue} />
      </View>
    </Card>
  );
}
