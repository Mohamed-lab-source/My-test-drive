import React, { useEffect, useState } from 'react';
import { Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../../ui/Icon';
import { useSettingsStore } from '../../store/settingsStore';
import { findPrayerCity, formatCountdown, getNextPrayer } from '../../utils/prayerTimes';

const NAMES: Record<string, string> = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

// "Asr in 1h 20m" under the Home title, once a prayer city is set.
export function NextPrayerChip() {
  const { colors, typography, spacing, radius } = useTheme();
  const router = useRouter();
  const city = findPrayerCity(useSettingsStore((s) => s.prayerCityId));
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!city) return null;
  const next = getNextPrayer(city, now);
  return (
    <Pressable
      onPress={() => router.push('/life/prayer-times')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: colors.green + '1F',
        borderRadius: radius.lg,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        marginTop: 4,
      }}
    >
      <Icon name="moon.stars.fill" size={13} color={colors.green} />
      <Text style={[typography.footnote, { color: colors.green, fontWeight: '600', marginLeft: 4 }]}>
        {NAMES[next.prayer]} in {formatCountdown(next.time.getTime() - now.getTime())}
      </Text>
    </Pressable>
  );
}
