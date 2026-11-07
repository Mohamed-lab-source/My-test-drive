import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { useSettingsStore } from '../../store/settingsStore';
import { toHijri } from '../../utils/hijri';
import { findPrayerCity, formatCountdown, getPrayerSchedule } from '../../utils/prayerTimes';
import { formatTime } from '../../utils/date';

const RAMADAN = 9;

// Suhoor/iftar countdown, shown only during Ramadan once a prayer city is set.
export function RamadanCard() {
  const { colors, typography, spacing } = useTheme();
  const hijriOffset = useSettingsStore((s) => s.hijriOffset);
  const city = findPrayerCity(useSettingsStore((s) => s.prayerCityId));
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const hijri = toHijri(now, hijriOffset);
  if (!city || hijri.month !== RAMADAN) return null;

  const today = getPrayerSchedule(city, now);
  let label: string;
  let target: Date;
  if (now < today.fajr) {
    label = 'Suhoor ends';
    target = today.fajr;
  } else if (now < today.maghrib) {
    label = 'Iftar';
    target = today.maghrib;
  } else {
    label = 'Suhoor ends';
    target = getPrayerSchedule(city, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)).fajr;
  }

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
      <Icon name="moon.stars.fill" size={28} color={colors.purple} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Ramadan · day {hijri.day}</Text>
        <Text style={[typography.headline, { color: colors.label }]}>
          {label} at {formatTime(target.toISOString())}
        </Text>
      </View>
      <Text style={[typography.title3, { color: colors.purple }]}>{formatCountdown(target.getTime() - now.getTime())}</Text>
    </Card>
  );
}
