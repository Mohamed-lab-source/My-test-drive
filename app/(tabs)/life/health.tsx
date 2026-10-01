import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { Icon } from '../../../src/ui/Icon';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { TextField } from '../../../src/ui/TextField';
import { Button } from '../../../src/ui/Button';
import { MiniBars, lastDays } from '../../../src/ui/MiniBars';
import { useSettingsStore } from '../../../src/store/settingsStore';
import * as repo from '../../../src/db/repositories/health';
import { todayKey } from '../../../src/db/client';
import { formatClock, formatDateKey } from '../../../src/utils/date';
import { requestNotificationPermission, scheduleBedtimeReminder } from '../../../src/notifications/scheduler';
import type { SleepLog, WaterLog, WeightLog } from '../../../src/db/types';

const SLEEP_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

export default function HealthScreen() {
  const { colors, typography, spacing } = useTheme();
  const { waterGoal, setWaterGoal, bedtime, setBedtime, weightGoal, setWeightGoal, notificationsEnabled } = useSettingsStore();
  const [goalInput, setGoalInput] = useState(weightGoal > 0 ? String(weightGoal) : '');
  const today = todayKey();
  const week = lastDays(7, todayKey);
  const [water, setWater] = useState<WaterLog[]>([]);
  const [sleep, setSleep] = useState<SleepLog[]>([]);
  const [weight, setWeight] = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState('');

  const load = useCallback(async () => {
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const key = todayKey(since);
    const [w, s, kg] = await Promise.all([repo.listWaterSince(key), repo.listSleepSince(key), repo.listWeightSince(key)]);
    setWater(w);
    setSleep(s);
    setWeight(kg);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const glasses = water.find((w) => w.id === today)?.count ?? 0;
  const lastNight = sleep.find((s) => s.id === today)?.hours ?? null;
  const sleepWeek = week.map((d) => ({ ...d, value: sleep.find((s) => s.id === d.key)?.hours ?? 0 }));
  const sleepLogged = sleepWeek.filter((d) => d.value > 0);
  const sleepAvg = sleepLogged.length ? sleepLogged.reduce((a, d) => a + d.value, 0) / sleepLogged.length : null;
  const latestWeight = weight[weight.length - 1];
  const firstWeight = weight[0];
  const weightChange = latestWeight && firstWeight && latestWeight !== firstWeight ? latestWeight.kg - firstWeight.kg : null;
  const weightMin = Math.min(...weight.map((w) => w.kg));
  const weightRange = Math.max(0.5, Math.max(...weight.map((w) => w.kg)) - weightMin);

  const changeWater = async (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await repo.setWater(today, glasses + delta);
    if (glasses + delta === waterGoal && delta > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await load();
  };

  const saveWeight = async () => {
    const kg = Number(weightInput.replace(',', '.'));
    if (!(kg > 0)) return;
    await repo.setWeight(today, kg);
    setWeightInput('');
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Health" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>💧 Water</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: spacing.sm }}>
            <Pressable onPress={() => changeWater(-1)} disabled={glasses === 0} hitSlop={8}>
              <Icon name="minus.circle" size={36} color={glasses === 0 ? colors.gray4 : colors.blue} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[typography.largeTitle, { color: glasses >= waterGoal ? colors.green : colors.label }]}>
                {glasses}
                <Text style={[typography.title3, { color: colors.secondaryLabel }]}> / {waterGoal}</Text>
              </Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                {glasses >= waterGoal ? 'Goal reached today' : `${waterGoal - glasses} more glass${waterGoal - glasses === 1 ? '' : 'es'} to go`}
              </Text>
            </View>
            <Pressable onPress={() => changeWater(1)} hitSlop={8}>
              <Icon name="plus.circle.fill" size={36} color={colors.blue} />
            </Pressable>
          </View>
          <MiniBars data={week.map((d) => ({ ...d, value: water.find((w) => w.id === d.key)?.count ?? 0 }))} color={colors.blue} max={waterGoal} />
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: spacing.sm, marginBottom: 6 }]}>Daily goal</Text>
          <ChipSelector
            options={[6, 8, 10, 12].map((n) => ({ id: String(n), label: `${n} glasses` }))}
            selectedId={String(waterGoal)}
            onSelect={(id) => setWaterGoal(Number(id))}
          />
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>😴 Sleep</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
            {lastNight !== null ? `Last night: ${lastNight} h` : 'How long did you sleep last night?'}
            {sleepAvg !== null ? ` · 7-day average ${sleepAvg.toFixed(1)} h` : ''}
          </Text>
          <ChipSelector
            options={SLEEP_OPTIONS.map((h) => ({ id: String(h), label: `${h} h` }))}
            selectedId={lastNight !== null ? String(lastNight) : null}
            onSelect={async (id) => {
              await repo.setSleep(today, Number(id));
              await load();
            }}
          />
          <View style={{ marginTop: spacing.md }}>
            <MiniBars data={sleepWeek} color={colors.indigo} max={9} />
          </View>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: spacing.md, marginBottom: 6 }]}>Bedtime reminder</Text>
          <ChipSelector
            options={[{ id: 'off', label: 'Off' }, ...['21:30', '22:00', '22:30', '23:00', '23:30'].map((t) => ({ id: t, label: formatClock(t) }))]}
            selectedId={bedtime ?? 'off'}
            onSelect={async (id) => {
              if (id !== 'off' && !notificationsEnabled) await requestNotificationPermission();
              setBedtime(id === 'off' ? null : id);
              await scheduleBedtimeReminder();
            }}
          />
        </Card>

        <Card>
          <Text style={[typography.headline, { color: colors.label }]}>⚖️ Weight</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
            {latestWeight ? `${latestWeight.kg} kg on ${formatDateKey(latestWeight.id)}` : 'Log your weight to see the trend.'}
            {weightChange !== null ? ` · ${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg over 90 days` : ''}
          </Text>
          {weightGoal > 0 && latestWeight ? (
            <Text style={[typography.subhead, { color: Math.abs(latestWeight.kg - weightGoal) < 0.05 ? colors.green : colors.pink, marginBottom: spacing.sm, fontWeight: '600' }]}>
              {Math.abs(latestWeight.kg - weightGoal) < 0.05
                ? 'At your goal 🎉'
                : `${Math.abs(latestWeight.kg - weightGoal).toFixed(1)} kg to your ${weightGoal} kg goal`}
            </Text>
          ) : null}
          {weight.length >= 2 ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, marginBottom: spacing.sm }}>
              {weight.slice(-30).map((w) => (
                <View
                  key={w.id}
                  style={{
                    flex: 1,
                    marginHorizontal: 1,
                    borderRadius: 2,
                    backgroundColor: colors.pink,
                    height: 8 + ((w.kg - weightMin) / weightRange) * 52,
                  }}
                />
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <TextField placeholder="Today's weight (kg)" keyboardType="decimal-pad" value={weightInput} onChangeText={setWeightInput} />
            </View>
            <Button title="Save" onPress={saveWeight} disabled={!(Number(weightInput.replace(',', '.')) > 0)} style={{ paddingHorizontal: spacing.lg }} />
          </View>
          <TextField
            label="Goal (kg)"
            placeholder="Optional"
            keyboardType="decimal-pad"
            value={goalInput}
            onChangeText={setGoalInput}
            onBlur={() => setWeightGoal(Number(goalInput.replace(',', '.')) || 0)}
          />
        </Card>
      </ScrollView>
    </View>
  );
}
