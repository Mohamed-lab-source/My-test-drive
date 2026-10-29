import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable, Share } from 'react-native';
import { NavHeader } from '../src/ui/NavHeader';
import { useTheme } from '../src/theme/ThemeProvider';
import { Card } from '../src/ui/Card';
import { useLifeStore } from '../src/store/lifeStore';
import { useProductivityStore } from '../src/store/productivityStore';
import { useFinanceStore } from '../src/store/financeStore';
import { useHabitsStore } from '../src/store/habitsStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { useWaterStore } from '../src/store/waterStore';
import * as productivityRepo from '../src/db/repositories/productivity';
import * as lifeRepo from '../src/db/repositories/life';
import { convertToBase } from '../src/db/repositories/fx';
import { todayKey } from '../src/db/client';
import { localDateKey } from '../src/utils/date';
import { formatMoney } from '../src/utils/money';

const MOOD_EMOJI: Record<string, string> = { great: '😄', good: '🙂', okay: '😐', low: '😕', rough: '😣' };

// Everything about today on one screen, ready to reflect on (or share).
export default function RecapScreen() {
  const { colors, typography, spacing } = useTheme();
  const today = todayKey();
  const { todayPrayerLogs, dhikrToday, journalEntries } = useLifeStore(useShallow((s) => ({ todayPrayerLogs: s.todayPrayerLogs, dhikrToday: s.dhikrToday, journalEntries: s.journalEntries })));
  const tasks = useProductivityStore((s) => s.tasks);
  const { transactions, fxRates } = useFinanceStore(useShallow((s) => ({ transactions: s.transactions, fxRates: s.fxRates })));
  const { habits, todayLogs } = useHabitsStore(useShallow((s) => ({ habits: s.habits, todayLogs: s.todayLogs })));
  const { currency, waterGoal } = useSettingsStore(useShallow((s) => ({ currency: s.currency, waterGoal: s.waterGoal })));
  const water = useWaterStore((s) => s.count);
  const [focus, setFocus] = useState(0);
  const [pages, setPages] = useState(0);

  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    productivityRepo.listFocusSessionsSince(start.toISOString()).then((s) => setFocus(s.reduce((a, x) => a + x.minutes, 0)));
    lifeRepo.quranPagesByDateSince(today).then((m) => setPages(m[today] ?? 0));
    useWaterStore.getState().load();
  }, [today]);

  const prayers = todayPrayerLogs.filter((l) => l.completed).length;
  const tasksDone = tasks.filter((t) => t.status === 'done' && t.completed_at && localDateKey(t.completed_at) === today).length;
  const todayTx = transactions.filter((t) => localDateKey(t.date) === today);
  const spent = todayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + convertToBase(t.amount, t.currency, currency, fxRates), 0);
  const earned = todayTx.filter((t) => t.type === 'income').reduce((s, t) => s + convertToBase(t.amount, t.currency, currency, fxRates), 0);
  const habitsDone = todayLogs.filter((l) => l.completed).length;
  const mood = journalEntries.find((e) => e.date === today);

  const rows = [
    { emoji: '🕌', label: 'Prayers', value: `${prayers} of 5` },
    { emoji: '✅', label: 'Tasks done', value: String(tasksDone) },
    { emoji: '⏱', label: 'Focus', value: focus ? `${focus} min` : '—' },
    { emoji: '💸', label: 'Spent', value: formatMoney(spent, currency) },
    ...(earned ? [{ emoji: '💰', label: 'Earned', value: formatMoney(earned, currency) }] : []),
    { emoji: '📖', label: 'Quran', value: pages ? `${pages} page${pages === 1 ? '' : 's'}` : '—' },
    { emoji: '📿', label: 'Dhikr', value: dhikrToday ? String(dhikrToday) : '—' },
    { emoji: '💧', label: 'Water', value: `${water} of ${waterGoal}` },
    ...(habits.length ? [{ emoji: '🔥', label: 'Habits', value: `${habitsDone} of ${habits.length}` }] : []),
    { emoji: mood ? MOOD_EMOJI[mood.mood] : '📝', label: 'Mood', value: mood ? mood.mood : 'not logged' },
  ];

  const share = () =>
    Share.share({
      message: [
        `My day — ${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`,
        ...rows.map((r) => `${r.emoji} ${r.label}: ${r.value}`),
      ].join('\n'),
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Today's recap" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card padded={false}>
          {rows.map((r, i) => (
            <View
              key={r.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.md,
                borderBottomWidth: i === rows.length - 1 ? 0 : 0.5,
                borderBottomColor: colors.separator,
              }}
            >
              <Text style={{ fontSize: 22, width: 36 }}>{r.emoji}</Text>
              <Text style={[typography.body, { color: colors.label, flex: 1 }]}>{r.label}</Text>
              <Text style={[typography.body, { color: colors.secondaryLabel, fontWeight: '600', textTransform: 'capitalize' }]}>{r.value}</Text>
            </View>
          ))}
        </Card>
        <Pressable onPress={share} style={{ alignSelf: 'center', marginTop: spacing.lg }}>
          <Text style={[typography.headline, { color: colors.blue }]}>Share my day</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
