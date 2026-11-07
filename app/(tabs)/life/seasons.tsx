import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable } from 'react-native';
import * as Haptics from '../../../src/utils/haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { toHijri } from '../../../src/utils/hijri';
import { todayKey } from '../../../src/db/client';
import * as lifeRepo from '../../../src/db/repositories/life';

// Day 1 of a Hijri month: the current one if we're in it, else the next.
function monthStart(month: number, offset: number, now: Date): { start: Date; year: number } {
  for (let i = -30; i < 390; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const h = toHijri(d, offset);
    if (h.month === month && h.day === 1) return { start: d, year: h.year };
  }
  return { start: now, year: toHijri(now, offset).year };
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const NIGHT_ACTS = ['Qiyam / Tahajjud', 'Quran recitation', 'Dua: Allahumma innaka ʿafuwwun…', 'Sadaqah', 'Istighfar'];
const DHUL_HIJJAH_ACTS = ['Takbir every day', 'Fast the Day of Arafah', 'Udhiyah (sacrifice) arranged', 'Eid prayer', 'Extra sadaqah', 'Cut no hair or nails (if sacrificing)'];

// Checklists for the blessed seasons: the last ten nights of Ramadan, the
// first ten days of Dhul Hijjah and the six fasts of Shawwal.
export default function SeasonsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { hijriOffset, checklists, toggleChecklistItem } = useSettingsStore(useShallow((s) => ({ hijriOffset: s.hijriOffset, checklists: s.checklists, toggleChecklistItem: s.toggleChecklistItem })));
  const now = useMemo(() => new Date(), []);
  // Each search converts up to ~400 dates to Hijri, so do it once.
  const { ramadan, dhulHijjah, shawwal, muharram } = useMemo(
    () => ({
      ramadan: monthStart(9, hijriOffset, now),
      dhulHijjah: monthStart(12, hijriOffset, now),
      shawwal: monthStart(10, hijriOffset, now),
      muharram: monthStart(1, hijriOffset, now),
    }),
    [hijriOffset, now]
  );
  const [fasts, setFasts] = useState<Set<string>>(new Set());
  const [reload, setReload] = useState(0);

  useEffect(() => {
    lifeRepo.listFastingLogsSince(todayKey(addDays(now, -400))).then((logs) => setFasts(new Set(logs.map((l) => l.date))));
  }, [reload]);

  const tick = (key: string, item: string) => {
    Haptics.selectionAsync();
    toggleChecklistItem(key, item);
  };
  const toggleFast = async (key: string) => {
    Haptics.selectionAsync();
    await lifeRepo.setFast(key, fasts.has(key) ? null : 'voluntary');
    setReload((r) => r + 1);
  };

  const nightsKey = `ramadan-${ramadan.year}`;
  const dhKey = `dhulhijjah-${dhulHijjah.year}`;
  const nights = Array.from({ length: 10 }, (_, i) => ({ night: 21 + i, date: addDays(ramadan.start, 20 + i) }));
  const nineDays = Array.from({ length: 9 }, (_, i) => ({ day: i + 1, key: todayKey(addDays(dhulHijjah.start, i)) }));
  const shawwalDays = Array.from({ length: 29 }, (_, i) => todayKey(addDays(shawwal.start, i + 1)));
  const shawwalFasts = shawwalDays.filter((k) => fasts.has(k)).length;
  const ashuraDays = [9, 10, 11].map((d) => ({ day: d, key: todayKey(addDays(muharram.start, d - 1)) }));
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const daysUntil = (d: Date) => Math.round((d.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);

  const chip = (label: string, on: boolean, onPress: () => void, sub?: string) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        margin: 3,
        alignItems: 'center',
        backgroundColor: on ? colors.green : colors.tertiaryFill,
      }}
    >
      <Text style={{ fontWeight: '700', color: on ? '#fff' : colors.label }}>{label}</Text>
      {sub ? <Text style={{ fontSize: 10, color: on ? '#fff' : colors.secondaryLabel }}>{sub}</Text> : null}
    </Pressable>
  );
  const checklist = (key: string, items: string[]) =>
    items.map((item) => {
      const on = (checklists[key] ?? []).includes(item);
      return (
        <Pressable key={item} onPress={() => tick(key, item)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
          <Text style={{ fontSize: 18, color: on ? colors.green : colors.tertiaryLabel, width: 28 }}>{on ? '✓' : '○'}</Text>
          <Text style={[typography.body, { color: on ? colors.secondaryLabel : colors.label, flex: 1 }]}>{item}</Text>
        </Pressable>
      );
    });
  const when = (d: Date) => {
    const n = daysUntil(d);
    return n > 0 ? `starts in ${n} day${n === 1 ? '' : 's'} (${fmt(d)})` : `started ${fmt(d)}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Blessed seasons" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>🌙 Last ten nights · {ramadan.year} AH</Text>
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
            Night 21 {when(nights[0].date)}. Tap each night you stood in prayer.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {nights.map((n) =>
              chip(String(n.night), (checklists[nightsKey] ?? []).includes(`night-${n.night}`), () => tick(nightsKey, `night-${n.night}`), n.night % 2 ? 'odd' : undefined)
            )}
          </View>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: spacing.sm }]}>Each night</Text>
          {checklist(`${nightsKey}-acts`, NIGHT_ACTS)}
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>🕋 First ten days of Dhul Hijjah · {dhulHijjah.year} AH</Text>
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
            {when(dhulHijjah.start)}. Tap a day you fasted (day 9 is Arafah).
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {nineDays.map((d) => chip(String(d.day), fasts.has(d.key), () => toggleFast(d.key), d.day === 9 ? 'Arafah' : undefined))}
          </View>
          {checklist(dhKey, DHUL_HIJJAH_ACTS)}
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>🌙 Ashura · Muharram {muharram.year} AH</Text>
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
            {when(muharram.start)}. Fast the 10th with the 9th (Tasu'a) or the 11th — tap the days you fast.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {ashuraDays.map((d) => chip(String(d.day), fasts.has(d.key), () => toggleFast(d.key), d.day === 9 ? "Tasu'a" : d.day === 10 ? 'Ashura' : undefined))}
          </View>
        </Card>

        <Card>
          <Text style={[typography.headline, { color: colors.label }]}>🌤 Six days of Shawwal · {shawwal.year} AH</Text>
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
            {when(shawwal.start)}. Fasts you log in Shawwal (after Eid) count here.
          </Text>
          <View style={{ flexDirection: 'row' }}>
            {Array.from({ length: 6 }, (_, i) => (
              <View
                key={i}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  marginRight: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: i < shawwalFasts ? colors.green : colors.tertiaryFill,
                }}
              >
                <Text style={{ color: i < shawwalFasts ? '#fff' : colors.secondaryLabel, fontWeight: '700' }}>{i + 1}</Text>
              </View>
            ))}
          </View>
          <Text style={[typography.subhead, { color: shawwalFasts >= 6 ? colors.green : colors.secondaryLabel, marginTop: spacing.sm }]}>
            {shawwalFasts >= 6 ? 'All six done — like fasting the whole year. 🎉' : `${shawwalFasts} of 6 fasted`}
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}
