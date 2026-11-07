import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import * as repo from '../../db/repositories/lists';
import { daysUntilKey, describeCountdown } from '../../utils/countdown';
import type { Countdown } from '../../db/types';

// The nearest upcoming countdown, if any.
export function CountdownCard() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const [next, setNext] = useState<Countdown | null>(null);

  useEffect(() => {
    repo.listCountdowns().then((all) => setNext(all.find((c) => daysUntilKey(c.date) >= 0) ?? null));
  }, []);

  if (!next) return null;
  const days = daysUntilKey(next.date);
  return (
    <Pressable onPress={() => router.push('/life/countdowns')} style={{ marginBottom: spacing.md }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name="hourglass" size={22} color={colors.indigo} />
        <Text style={[typography.headline, { color: colors.label, flex: 1, marginLeft: spacing.sm }]} numberOfLines={1}>
          {next.title}
        </Text>
        <Text style={[typography.title3, { color: days <= 7 ? colors.orange : colors.indigo }]}>
          {days > 1 ? `${days} days` : describeCountdown(days)}
        </Text>
      </Card>
    </Pressable>
  );
}
