import React, { useMemo } from 'react';
import { ScrollView, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { useSettingsStore } from '../../store/settingsStore';
import { toHijri } from '../../utils/hijri';
import { todayKey } from '../../db/client';

const EVENTS = [
  { month: 9, day: 1, label: '🌙 Ramadan' },
  { month: 10, day: 1, label: '🎉 Eid al-Fitr' },
  { month: 12, day: 9, label: '🕋 Arafah' },
  { month: 12, day: 10, label: '🐑 Eid al-Adha' },
];

// Days until the next Ramadan and Eids, from the Hijri calendar.
export function SeasonCountdownCard() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const hijriOffset = useSettingsStore((s) => s.hijriOffset);
  const key = todayKey();

  const upcoming = useMemo(() => {
    const out: { label: string; days: number }[] = [];
    const now = new Date();
    for (let i = 0; i <= 360 && out.length < EVENTS.length; i++) {
      const h = toHijri(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i), hijriOffset);
      const e = EVENTS.find((x) => x.month === h.month && x.day === h.day);
      if (e && !out.some((o) => o.label === e.label)) out.push({ label: e.label, days: i });
    }
    return out.sort((a, b) => a.days - b.days);
  }, [key, hijriOffset]);

  if (upcoming.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
      {upcoming.map((e) => (
        <Pressable
          key={e.label}
          onPress={() => router.push('/life/hijri-calendar')}
          style={{
            backgroundColor: colors.secondarySystemGroupedBackground,
            borderRadius: 16,
            paddingHorizontal: spacing.md,
            paddingVertical: 8,
            marginRight: spacing.sm,
          }}
        >
          <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>
            {e.label} · <Text style={{ color: e.days <= 14 ? colors.orange : colors.secondaryLabel }}>
              {e.days === 0 ? 'today' : e.days === 1 ? 'tomorrow' : `${e.days} days`}
            </Text>
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
