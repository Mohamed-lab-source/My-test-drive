import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { useLifeStore } from '../../store/lifeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { PRAYERS } from '../../db/types';
import { findPrayerCity, formatCountdown, getNextPrayer, getPrayerSchedule } from '../../utils/prayerTimes';
import { formatTime } from '../../utils/date';

const PRAYER_LABELS: Record<string, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

// Re-renders once a minute so the countdown and "next prayer" stay current.
function useMinuteTick(): Date {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const handle = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(handle);
  }, []);
  return now;
}

export function PrayerTracker() {
  const { colors, typography, spacing } = useTheme();
  const { togglePrayer, isPrayerDone, prayerStreak } = useLifeStore();
  const city = findPrayerCity(useSettingsStore((s) => s.prayerCityId));
  const now = useMinuteTick();

  const schedule = useMemo(() => (city ? getPrayerSchedule(city, now) : null), [city, now.toDateString()]);
  const next = city ? getNextPrayer(city, now) : null;
  const nextIsToday = next ? next.time.toDateString() === now.toDateString() : false;

  const completedCount = PRAYERS.filter((p) => isPrayerDone(p)).length;

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.headline, { color: colors.label }]}>Today's Prayers</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
            {next
              ? `Next: ${PRAYER_LABELS[next.prayer]} at ${formatTime(next.time.toISOString())} · in ${formatCountdown(next.time.getTime() - now.getTime())}`
              : `${completedCount} of 5 completed`}
          </Text>
        </View>
        {prayerStreak > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="sparkles" size={16} color={colors.orange} />
            <Text style={[typography.subhead, { color: colors.orange, marginLeft: 4, fontWeight: '700' }]}>{prayerStreak}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {PRAYERS.map((prayer) => {
          const done = isPrayerDone(prayer);
          const isNext = nextIsToday && next?.prayer === prayer;
          return (
            <Pressable
              key={prayer}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                togglePrayer(prayer, !done);
              }}
              style={{ alignItems: 'center' }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: done ? colors.green : colors.fill,
                  borderWidth: isNext && !done ? 2 : 0,
                  borderColor: colors.blue,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                <Icon name={done ? 'checkmark.circle.fill' : 'moon.stars.fill'} size={20} color={done ? '#fff' : colors.secondaryLabel} />
              </View>
              <Text style={[typography.caption2, { color: isNext ? colors.blue : colors.secondaryLabel, fontWeight: isNext ? '700' : '400' }]}>
                {PRAYER_LABELS[prayer]}
              </Text>
              {schedule ? (
                <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>{formatTime(schedule[prayer].toISOString())}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {!city ? (
        <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: spacing.sm }]}>
          Pick your city in Settings to see prayer times.
        </Text>
      ) : null}
    </Card>
  );
}
