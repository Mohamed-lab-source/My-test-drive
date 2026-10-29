import React, { useEffect, useState } from 'react';
import { Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../../ui/Icon';
import { useProductivityStore } from '../../store/productivityStore';
import { formatCountdown } from '../../utils/prayerTimes';

const WINDOW_MS = 6 * 3600000;

// "Standup in 25m" when a meeting starts within the next six hours.
export function NextMeetingChip() {
  const { colors, typography, spacing, radius } = useTheme();
  const router = useRouter();
  const meetings = useProductivityStore((s) => s.meetings);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const next = meetings
    .filter((m) => {
      const t = new Date(m.start_at).getTime();
      return t > now && t - now <= WINDOW_MS;
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at))[0];
  if (!next) return null;

  return (
    <Pressable
      onPress={() => router.push('/tasks/meetings')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: colors.indigo + '1F',
        borderRadius: radius.lg,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        marginTop: 4,
      }}
    >
      <Icon name="calendar" size={13} color={colors.indigo} />
      <Text style={[typography.footnote, { color: colors.indigo, fontWeight: '600', marginLeft: 4 }]} numberOfLines={1}>
        {next.title} in {formatCountdown(new Date(next.start_at).getTime() - now)}
      </Text>
    </Pressable>
  );
}
