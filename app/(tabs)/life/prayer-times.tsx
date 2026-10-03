import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { Icon } from '../../../src/ui/Icon';
import { useSettingsStore } from '../../../src/store/settingsStore';
import {
  findPrayerCity,
  formatCountdown,
  getDayDetails,
  getNextPrayer,
  getPrayerSchedule,
  getQibla,
} from '../../../src/utils/prayerTimes';
import { formatTime } from '../../../src/utils/date';
import type { Prayer } from '../../../src/db/types';

const PRAYERS: { key: Prayer; label: string }[] = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
];

const t = (d: Date) => formatTime(d.toISOString());
// Compact time for the weekly table, e.g. "4:12".
const short = (d: Date) => t(d).replace(/\s?[AP]M$/i, '');

export default function PrayerTimesScreen() {
  const { colors, typography, spacing } = useTheme();
  const city = findPrayerCity(useSettingsStore((s) => s.prayerCityId));
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!city) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
        <NavHeader title="Prayer times" />
        <View style={{ padding: spacing.lg }}>
          <Card>
            <Text style={[typography.body, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
              Choose your city in Settings to see prayer times, the Qibla direction and a weekly timetable.
            </Text>
            <Pressable onPress={() => router.push('/settings')}>
              <Text style={[typography.headline, { color: colors.blue }]}>Open Settings</Text>
            </Pressable>
          </Card>
        </View>
      </View>
    );
  }

  const today = getDayDetails(city, now);
  const next = getNextPrayer(city, now);
  const qibla = getQibla(city);
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    return { day, times: getPrayerSchedule(city, day) };
  });

  const rows: { label: string; time: Date; key?: Prayer; muted?: boolean }[] = [
    { label: 'Fajr', time: today.fajr, key: 'fajr' },
    { label: 'Sunrise', time: today.sunrise, muted: true },
    { label: 'Dhuhr', time: today.dhuhr, key: 'dhuhr' },
    { label: 'Asr', time: today.asr, key: 'asr' },
    { label: 'Maghrib', time: today.maghrib, key: 'maghrib' },
    { label: 'Isha', time: today.isha, key: 'isha' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Prayer times" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{city.name} · Next prayer</Text>
          <Text style={[typography.title2, { color: colors.label, marginTop: 2 }]}>
            {PRAYERS.find((p) => p.key === next.prayer)?.label} at {t(next.time)}
          </Text>
          <Text style={[typography.subhead, { color: colors.blue, marginTop: 2 }]}>
            in {formatCountdown(next.time.getTime() - now.getTime())}
          </Text>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.xs }]}>Today</Text>
          {rows.map((r) => {
            const isNext = r.key === next.prayer && next.time.getTime() === r.time.getTime();
            return (
              <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={[typography.body, { color: r.muted ? colors.secondaryLabel : colors.label, fontWeight: isNext ? '700' : '400' }]}>
                  {r.label}
                </Text>
                <Text
                  style={[
                    typography.body,
                    { color: isNext ? colors.blue : r.muted ? colors.secondaryLabel : colors.label, fontWeight: isNext ? '700' : '500' },
                  ]}
                >
                  {t(r.time)}
                </Text>
              </View>
            );
          })}
          <View style={{ height: 1, backgroundColor: colors.separator, marginVertical: spacing.xs }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={[typography.body, { color: colors.secondaryLabel }]}>Last third of the night</Text>
            <Text style={[typography.body, { color: colors.secondaryLabel }]}>{t(today.lastThird)}</Text>
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>Qibla</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                borderWidth: 2,
                borderColor: colors.separator,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.md,
              }}
            >
              <Text style={{ position: 'absolute', top: 2, fontSize: 10, fontWeight: '700', color: colors.red }}>N</Text>
              <View style={{ transform: [{ rotate: `${qibla.degrees}deg` }] }}>
                <Icon name="arrow.up" size={30} color={colors.green} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title2, { color: colors.label }]}>
                {Math.round(qibla.degrees)}° {qibla.direction}
              </Text>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
                Clockwise from true north. Hold your phone flat with the top pointing north, then face the arrow.
              </Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>Next 7 days</Text>
          <View style={{ flexDirection: 'row', paddingBottom: 4 }}>
            <Text style={[typography.caption1, { color: colors.secondaryLabel, width: 44 }]} />
            {PRAYERS.map((p) => (
              <Text key={p.key} style={[typography.caption1, { color: colors.secondaryLabel, flex: 1, textAlign: 'center' }]}>
                {p.label}
              </Text>
            ))}
          </View>
          {week.map(({ day, times }, i) => (
            <View
              key={day.toDateString()}
              style={{
                flexDirection: 'row',
                paddingVertical: 6,
                borderTopWidth: 1,
                borderTopColor: colors.separator,
              }}
            >
              <Text style={[typography.footnote, { color: i === 0 ? colors.blue : colors.label, width: 44, fontWeight: '600' }]}>
                {i === 0 ? 'Today' : day.toLocaleDateString(undefined, { weekday: 'short' })}
              </Text>
              {PRAYERS.map((p) => (
                <Text key={p.key} style={[typography.footnote, { color: colors.label, flex: 1, textAlign: 'center' }]}>
                  {short(times[p.key])}
                </Text>
              ))}
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
