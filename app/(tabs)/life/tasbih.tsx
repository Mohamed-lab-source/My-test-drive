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
import { MiniBars, lastDays } from '../../../src/ui/MiniBars';

const TARGETS = [33, 99, 100];

// The tasbih after each obligatory prayer (Sahih Muslim): 33 + 33 + 33,
// completed to 100 with the tahlil.
const AFTER_SALAH = [
  { arabic: 'سُبْحَانَ اللهِ', text: 'SubhanAllah', count: 33 },
  { arabic: 'الْحَمْدُ لِلَّهِ', text: 'Alhamdulillah', count: 33 },
  { arabic: 'اللهُ أَكْبَرُ', text: 'Allahu Akbar', count: 33 },
  {
    arabic: 'لَا إِلَٰهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
    text: 'La ilaha illallah… (completes the 100)',
    count: 1,
  },
];
const SALAH_TOTAL = AFTER_SALAH.reduce((s, x) => s + x.count, 0);

function salahStep(position: number) {
  let left = position;
  for (const [i, step] of AFTER_SALAH.entries()) {
    if (left < step.count) return { index: i, step, done: left };
    left -= step.count;
  }
  return { index: AFTER_SALAH.length, step: null, done: 0 };
}

const PERSIST_DELAY_MS = 800;

export default function TasbihScreen() {
  const { colors, typography, spacing } = useTheme();
  const dhikrToday = useLifeStore((s) => s.dhikrToday);
  const [total, setTotal] = useState(dhikrToday);
  const [target, setTarget] = useState(33);
  const [mode, setMode] = useState<'free' | 'salah'>('free');
  const [salahPos, setSalahPos] = useState(0);
  const [history, setHistory] = useState<Record<string, number>>({});
  const week = lastDays(7, todayKey);
  useEffect(() => {
    repo.listDhikrSince(week[0].key).then((rows) => setHistory(Object.fromEntries(rows.map((r) => [r.date, r.count]))));
  }, []);
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
    if (mode === 'salah') {
      // After finishing, the next tap starts a fresh sequence.
      const pos = salahPos >= SALAH_TOTAL ? 1 : salahPos + 1;
      setSalahPos(pos);
      const before = salahStep(pos - 1);
      const after = salahStep(pos);
      if (pos === SALAH_TOTAL || before.index !== after.index) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
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
            options={[...TARGETS.map((t) => ({ id: String(t), label: `${t}` })), { id: 'salah', label: 'After salah' }]}
            selectedId={mode === 'salah' ? 'salah' : String(target)}
            onSelect={(id) => {
              if (id === 'salah') {
                setMode('salah');
                setSalahPos(0);
              } else {
                setMode('free');
                setTarget(Number(id));
              }
            }}
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
            {mode === 'salah' ? (
              (() => {
                const cur = salahStep(salahPos);
                if (!cur.step) {
                  return <Text style={[typography.title2, { color: colors.green }]}>Complete ✓</Text>;
                }
                return (
                  <>
                    <Text style={{ fontSize: 56, fontWeight: '300', color: colors.label, fontVariant: ['tabular-nums'] }}>
                      {cur.done}
                    </Text>
                    <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>of {cur.step.count}</Text>
                  </>
                );
              })()
            ) : (
              <>
                <Text style={{ fontSize: 72, fontWeight: '300', color: colors.label, fontVariant: ['tabular-nums'] }}>{ring}</Text>
                <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>of {target}</Text>
              </>
            )}
          </Pressable>
        </Animated.View>
        {mode === 'salah' ? (
          <View style={{ alignItems: 'center', marginTop: spacing.lg, minHeight: 90, paddingHorizontal: spacing.md }}>
            {(() => {
              const cur = salahStep(salahPos);
              return cur.step ? (
                <>
                  <Text style={{ fontSize: 26, color: colors.label, textAlign: 'center', writingDirection: 'rtl' }}>{cur.step.arabic}</Text>
                  <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: 4 }]}>
                    {cur.step.text} · step {cur.index + 1} of {AFTER_SALAH.length}
                  </Text>
                </>
              ) : (
                <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Tap to start again</Text>
              );
            })()}
          </View>
        ) : null}
        <Text style={[typography.body, { color: colors.secondaryLabel, marginTop: spacing.xl }]}>
          {mode === 'salah' ? `${Math.min(salahPos, SALAH_TOTAL)} of ${SALAH_TOTAL}` : `${rounds} round${rounds === 1 ? '' : 's'}`} · {total} today
        </Text>
        <Pressable onPress={reset} hitSlop={10} style={{ marginTop: spacing.md }}>
          <Text style={[typography.subhead, { color: colors.red }]}>Reset today</Text>
        </Pressable>
        <View style={{ alignSelf: 'stretch', marginTop: spacing.xl }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>Last 7 days</Text>
          <MiniBars
            data={week.map((d) => ({ ...d, value: d.key === todayKey() ? total : history[d.key] ?? 0 }))}
            color={colors.mint}
            height={50}
          />
        </View>
      </View>
    </View>
  );
}
