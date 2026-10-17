import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { TextField } from '../../../src/ui/TextField';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useHabitsStore } from '../../../src/store/habitsStore';
import { todayKey } from '../../../src/db/client';
import * as lifeRepo from '../../../src/db/repositories/life';
import * as health from '../../../src/db/repositories/health';
import * as habitsRepo from '../../../src/db/repositories/habits';
import { listBooks } from '../../../src/db/repositories/lists';
import { listJournalEntries } from '../../../src/db/repositories/journal';
import { findPrayerCity, getPrayerSchedule } from '../../../src/utils/prayerTimes';
import type { JournalMood } from '../../../src/db/types';

const MOOD_SCORE: Record<JournalMood, number> = { great: 5, good: 4, okay: 3, low: 2, rough: 1 };
const MOOD_EMOJI = ['', '😣', '😔', '😐', '🙂', '😄'];
const DAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const DAY = 86400000;
const keyDaysAgo = (n: number) => todayKey(new Date(Date.now() - n * DAY));

interface LifeData {
  onTime: { rate: number; count: number } | null;
  moodByDay: (number | null)[];
  journalStreak: number;
  gratitudeCount: number;
  waterAvg: number;
  waterBest: { key: string; count: number } | null;
  sleepThis: number | null;
  sleepLast: number | null;
  weight: number | null;
  medRate: number | null;
  books: { title: string; perDay: number; daysLeft: number | null }[];
  habits: { name: string; rate: number }[];
}

// Faith, mood, health and habit trends in one place.
export default function LifeInsightsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { prayerCityId, heightCm, setHeightCm } = useSettingsStore();
  const habits = useHabitsStore((s) => s.habits);
  const [data, setData] = useState<LifeData | null>(null);
  const [heightInput, setHeightInput] = useState(heightCm ? String(heightCm) : '');

  useEffect(() => {
    (async () => {
      const city = findPrayerCity(prayerCityId);
      // Prayers marked done within an hour of their adhan time, over 30 days.
      const prayerLogs = await lifeRepo.listPrayerLogsSince(keyDaysAgo(30));
      let onTime: LifeData['onTime'] = null;
      if (city) {
        const timed = prayerLogs.filter((l) => l.completed && l.completed_at && localKey(l.completed_at) === l.date);
        const hits = timed.filter((l) => {
          const [y, m, d] = l.date.split('-').map(Number);
          const t = getPrayerSchedule(city, new Date(y, m - 1, d))[l.prayer].getTime();
          const done = new Date(l.completed_at!).getTime();
          return done >= t && done - t <= 60 * 60000;
        });
        if (timed.length >= 5) onTime = { rate: hits.length / timed.length, count: timed.length };
      }

      const journal = await listJournalEntries(365);
      const sums = Array(7).fill(0);
      const counts = Array(7).fill(0);
      for (const e of journal) {
        const [y, m, d] = e.date.split('-').map(Number);
        const wd = new Date(y, m - 1, d).getDay();
        sums[wd] += MOOD_SCORE[e.mood];
        counts[wd]++;
      }
      const dates = new Set(journal.map((e) => e.date));
      let journalStreak = 0;
      for (let i = dates.has(todayKey()) ? 0 : 1; dates.has(keyDaysAgo(i)); i++) journalStreak++;
      const gratitudeCount = journal.reduce((n, e) => n + (e.gratitude ? e.gratitude.split('\n').filter((l) => l.trim()).length : 0), 0);

      const water = await health.listWaterSince(keyDaysAgo(6));
      const waterBest = water.reduce<{ key: string; count: number } | null>((b, w) => (!b || w.count > b.count ? { key: w.id, count: w.count } : b), null);
      const sleep = await health.listSleepSince(keyDaysAgo(13));
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
      const weights = await health.listWeightSince(keyDaysAgo(365));
      const latestWeight = [...weights].sort((a, b) => b.id.localeCompare(a.id))[0]?.kg ?? null;

      // Medication doses taken vs scheduled over the last 7 days.
      const meds = (await health.listMedications()).filter((m) => m.is_active);
      let due = 0;
      let taken = 0;
      for (let i = 0; i < 7; i++) {
        const key = keyDaysAgo(i);
        const logs = await health.listMedLogs(key);
        for (const m of meds) {
          if (localKey(m.created_at) > key) continue;
          const times = health.medicationTimes(m);
          due += times.length;
          taken += logs.filter((l) => l.medication_id === m.id).length;
        }
      }

      const books = (await listBooks())
        .filter((b) => b.status === 'reading' && b.pages_read > 0)
        .map((b) => {
          const days = Math.max(1, (Date.now() - new Date(b.created_at).getTime()) / DAY);
          const perDay = b.pages_read / days;
          return { title: b.title, perDay, daysLeft: perDay > 0 ? Math.ceil((b.total_pages - b.pages_read) / perDay) : null };
        });

      const monthStart = todayKey().slice(0, 8) + '01';
      const habitLogs = await habitsRepo.listAllHabitLogsSince(monthStart);
      const dayOfMonth = new Date().getDate();
      const habitRates = habits
        .map((h) => ({ name: h.name, rate: habitLogs.filter((l) => l.habit_id === h.id).length / dayOfMonth }))
        .sort((a, b) => b.rate - a.rate);

      setData({
        onTime,
        moodByDay: sums.map((s, i) => (counts[i] ? s / counts[i] : null)),
        journalStreak,
        gratitudeCount,
        waterAvg: water.reduce((a, w) => a + w.count, 0) / 7,
        waterBest,
        sleepThis: avg(sleep.filter((s) => s.id >= keyDaysAgo(6)).map((s) => s.hours)),
        sleepLast: avg(sleep.filter((s) => s.id < keyDaysAgo(6)).map((s) => s.hours)),
        weight: latestWeight,
        medRate: due ? taken / due : null,
        books,
        habits: habitRates,
      });
    })();
  }, [prayerCityId, habits]);

  const card = (emoji: string, title: string, children: React.ReactNode) => (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.headline, { color: colors.label, marginBottom: 2 }]}>
        {emoji} {title}
      </Text>
      {children}
    </Card>
  );
  const line = (text: string, color: string = colors.secondaryLabel, key?: string) => (
    <Text key={key} style={[typography.subhead, { color, marginTop: 2 }]}>
      {text}
    </Text>
  );

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
        <NavHeader title="Life insights" />
      </View>
    );
  }

  const moods = data.moodByDay.map((v, i) => ({ v, i })).filter((x) => x.v !== null) as { v: number; i: number }[];
  const bestMood = moods.length >= 3 ? moods.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const worstMood = moods.length >= 3 ? moods.reduce((a, b) => (b.v < a.v ? b : a)) : null;
  const bmi = heightCm > 0 && data.weight ? data.weight / Math.pow(heightCm / 100, 2) : null;
  const bmiLabel = bmi === null ? '' : bmi < 18.5 ? 'underweight' : bmi < 25 ? 'healthy range' : bmi < 30 ? 'overweight' : 'obese range';

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Life insights" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {card(
          '🕌',
          'Praying on time',
          data.onTime
            ? line(
                `${Math.round(data.onTime.rate * 100)}% of prayers were marked within an hour of the adhan (last 30 days, ${data.onTime.count} logged).`,
                data.onTime.rate >= 0.7 ? colors.green : colors.secondaryLabel
              )
            : line(findPrayerCity(prayerCityId) ? 'Mark prayers as you pray them to see this.' : 'Choose your city in Settings to see this.')
        )}

        {card(
          '😊',
          'Mood by weekday',
          <>
            <View style={{ flexDirection: 'row', marginTop: 4 }}>
              {data.moodByDay.map((v, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 20 }}>{v === null ? '·' : MOOD_EMOJI[Math.round(v)]}</Text>
                  <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>{DAY_NAMES[i].slice(0, 3)}</Text>
                </View>
              ))}
            </View>
            {bestMood && worstMood && bestMood.i !== worstMood.i
              ? line(`You tend to feel best on ${DAY_NAMES[bestMood.i]} and lowest on ${DAY_NAMES[worstMood.i]}.`)
              : null}
          </>
        )}

        {card('📓', 'Journal', <>
          {line(`${data.journalStreak} day${data.journalStreak === 1 ? '' : 's'} in a row`)}
          {line(`${data.gratitudeCount} things you've been grateful for`)}
        </>)}

        {card('🎯', 'Habits this month', data.habits.length ? (
          <>
            {line(`Strongest: ${data.habits[0].name} (${Math.round(data.habits[0].rate * 100)}%)`, colors.green)}
            {data.habits.length > 1
              ? line(`Needs care: ${data.habits[data.habits.length - 1].name} (${Math.round(data.habits[data.habits.length - 1].rate * 100)}%)`, colors.orange)
              : null}
          </>
        ) : line('Add a habit to see this.'))}

        {card('💧', 'Water (7 days)', <>
          {line(`${data.waterAvg.toFixed(1)} glasses a day on average`)}
          {data.waterBest ? line(`Best day: ${data.waterBest.count} glasses`) : null}
        </>)}

        {card('😴', 'Sleep', data.sleepThis !== null ? (
          <>
            {line(`${data.sleepThis.toFixed(1)} h a night this week`)}
            {data.sleepLast !== null ? line(`${data.sleepLast.toFixed(1)} h the week before`, data.sleepThis >= data.sleepLast ? colors.green : colors.orange) : null}
          </>
        ) : line('Log sleep in Health to see this.'))}

        {card('⚖️', 'BMI', <>
          {bmi !== null ? line(`${bmi.toFixed(1)} — ${bmiLabel} (from ${data.weight} kg)`, bmi >= 18.5 && bmi < 25 ? colors.green : colors.orange) : null}
          {!data.weight ? line('Log your weight in Health to see this.') : null}
          <View style={{ marginTop: spacing.sm }}>
            <TextField
              label="Height (cm)"
              keyboardType="number-pad"
              value={heightInput}
              onChangeText={setHeightInput}
              onBlur={() => setHeightCm(Math.round(Number(heightInput) || 0))}
            />
          </View>
        </>)}

        {data.medRate !== null
          ? card('💊', 'Medication (7 days)', line(`${Math.round(Math.min(1, data.medRate) * 100)}% of doses marked taken`, data.medRate >= 0.9 ? colors.green : colors.orange))
          : null}

        {data.books.length
          ? card('📚', 'Reading pace', <>
              {data.books.map((b) =>
                line(`${b.title}: ${b.perDay.toFixed(1)} pages/day${b.daysLeft !== null ? ` · done in about ${b.daysLeft} day${b.daysLeft === 1 ? '' : 's'}` : ''}`, undefined, b.title)
              )}
            </>)
          : null}
      </ScrollView>
    </View>
  );
}

function localKey(iso: string): string {
  return todayKey(new Date(iso));
}
